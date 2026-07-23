import { processCommand } from "../../../packages/game-engine/dist/index.js";
import { authenticate, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { loadGameState, serializeOutcome } from "../game-command/state.ts";

/**
 * Expulsa a un jugador desconectado (§56). Autoridad exclusiva del
 * anfitrión de la sala — a diferencia de game-command, acá el llamador
 * actúa sobre OTRO jugador, así que no alcanza con resolver el playerId
 * desde el JWT como en el resto de los comandos. Además de la autoridad
 * de anfitrión, exige que el objetivo lleve al menos
 * rooms.reconnect_timeout_seconds sin mandar un heartbeat — el motor en
 * sí no sabe nada de tiempo real, solo aplica el efecto una vez decidido.
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
      .select("id, game_id, last_seen_at")
      .eq("id", targetPlayerId)
      .maybeSingle();
    if (targetError) throw new HttpError(500, "INTERNAL_ERROR", targetError.message);
    if (!targetPlayer || targetPlayer.game_id !== gameId) {
      throw new HttpError(404, "PLAYER_NOT_FOUND", "El jugador no pertenece a esta partida.");
    }

    const disconnectedForSeconds = (Date.now() - new Date(targetPlayer.last_seen_at).getTime()) / 1000;
    if (disconnectedForSeconds < room.reconnect_timeout_seconds) {
      throw new HttpError(
        409,
        "PLAYER_NOT_DISCONNECTED_LONG_ENOUGH",
        `El jugador se reportó hace ${Math.round(disconnectedForSeconds)}s (límite: ${room.reconnect_timeout_seconds}s).`,
      );
    }

    const { state, version: expectedVersion } = await loadGameState(adminClient, gameId);

    const result = processCommand(state, { type: "REMOVE_PLAYER", targetPlayerId });
    if (!result.ok) {
      throw new HttpError(400, result.error.code, result.error.message);
    }

    const rpcParams = serializeOutcome(result.value);
    const { data: newVersion, error: rpcError } = await adminClient.rpc("apply_game_command", {
      p_game_id: gameId,
      p_expected_version: expectedVersion,
      ...rpcParams,
    });
    if (rpcError) {
      if (rpcError.message?.includes("version_conflict")) {
        throw new HttpError(409, "VERSION_CONFLICT", "El estado cambió antes de aplicar esto. Reintentá.");
      }
      throw new HttpError(500, "PERSIST_FAILED", rpcError.message);
    }

    return jsonResponse({ ok: true, version: newVersion, events: result.value.events }, 200);
  } catch (err) {
    return errorResponse(err);
  }
});
