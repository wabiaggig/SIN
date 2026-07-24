import { authenticate, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

/**
 * Expulsa a un jugador desconectado ANTES de que arranque la partida
 * (fase "lobby" o "waiting_for_entries") — el complemento de
 * remove-player, que solo cubre partida en curso (§56). Acá no hay
 * GameState del motor todavía (no se repartieron cartas), así que no
 * tiene sentido pasar por processCommand: alcanza con borrar la fila de
 * players y volver a numerar los asientos para que se mantengan
 * contiguos (join-room asume seat_index = cantidad de jugadores ya
 * sentados al calcular el próximo asiento).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return errorResponse(new HttpError(405, "METHOD_NOT_ALLOWED", "Solo se acepta POST."));
  }

  try {
    const { user, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const { gameId, targetPlayerId } = body ?? {};
    if (!gameId || typeof gameId !== "string" || !targetPlayerId || typeof targetPlayerId !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Se requiere { gameId, targetPlayerId }.");
    }

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id, room_id, phase")
      .eq("id", gameId)
      .single();
    if (gameError || !game) throw new HttpError(404, "GAME_NOT_FOUND", gameError?.message ?? "no encontrada");

    if (game.phase !== "lobby" && game.phase !== "waiting_for_entries") {
      throw new HttpError(
        409,
        "INVALID_PHASE",
        "Solo se puede expulsar así antes de que arranque la partida (usá remove-player durante el juego).",
      );
    }

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("host_user_id, reconnect_timeout_seconds")
      .eq("id", game.room_id)
      .single();
    if (roomError || !room) throw new HttpError(500, "ROOM_LOOKUP_FAILED", roomError?.message ?? "no encontrada");

    if (room.host_user_id !== user.id) {
      throw new HttpError(403, "NOT_HOST", "Solo el anfitrión puede expulsar jugadores.");
    }

    const { data: targetPlayer, error: targetError } = await adminClient
      .from("players")
      .select("id, game_id, user_id, status, seat_index, last_seen_at")
      .eq("id", targetPlayerId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, "INTERNAL_ERROR", targetError.message);
    if (!targetPlayer || targetPlayer.game_id !== gameId) {
      throw new HttpError(404, "PLAYER_NOT_FOUND", "El jugador no pertenece a esta partida.");
    }
    if (targetPlayer.user_id === room.host_user_id) {
      throw new HttpError(400, "CANNOT_REMOVE_HOST", "El anfitrión no puede expulsarse a sí mismo.");
    }

    const disconnectedForSeconds = (Date.now() - new Date(targetPlayer.last_seen_at).getTime()) / 1000;
    if (disconnectedForSeconds < room.reconnect_timeout_seconds) {
      throw new HttpError(
        409,
        "PLAYER_NOT_DISCONNECTED_LONG_ENOUGH",
        `El jugador se reportó hace ${Math.round(disconnectedForSeconds)}s (límite: ${room.reconnect_timeout_seconds}s).`,
      );
    }

    const { error: deleteError } = await adminClient.from("players").delete().eq("id", targetPlayerId);
    if (deleteError) throw new HttpError(500, "DELETE_FAILED", deleteError.message);

    // Vuelve a numerar los asientos restantes para que queden contiguos
    // desde 0 — join-room calcula el próximo asiento como la cantidad de
    // jugadores ya sentados, así que un hueco en el medio rompería el
    // constraint único de (game_id, seat_index) en el próximo join.
    const { data: remaining, error: remainingError } = await adminClient
      .from("players")
      .select("id, seat_index")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });
    if (remainingError) throw new HttpError(500, "RESEAT_LOOKUP_FAILED", remainingError.message);

    for (let i = 0; i < (remaining ?? []).length; i += 1) {
      const p = remaining![i]!;
      if (p.seat_index !== i) {
        const { error: updateError } = await adminClient.from("players").update({ seat_index: i }).eq("id", p.id);
        if (updateError) throw new HttpError(500, "RESEAT_FAILED", updateError.message);
      }
    }

    return jsonResponse({ ok: true }, 200);
  } catch (err) {
    return errorResponse(err);
  }
});
