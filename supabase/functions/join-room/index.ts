import { authenticate, HttpError } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: buildCorsHeaders(origin) });
  if (req.method !== "POST") {
    return errorResponse(new HttpError(405, "METHOD_NOT_ALLOWED", "Solo se acepta POST."), origin);
  }

  try {
    const { user, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const { inviteCode, displayName, avatarUrl } = body ?? {};

    if (!inviteCode || typeof inviteCode !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Falta el código de invitación.");
    }
    if (!displayName || typeof displayName !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Falta el nombre visible del jugador.");
    }

    // Descubrimiento por código vía la función pública (no SELECT directo
    // sobre rooms, ver supabase/migrations/0001).
    const { data: roomRows, error: roomError } = await adminClient.rpc("get_room_by_invite_code", {
      p_invite_code: inviteCode,
    });
    if (roomError) throw new HttpError(500, "ROOM_LOOKUP_FAILED", roomError.message);
    const room = roomRows?.[0];
    if (!room) {
      throw new HttpError(404, "ROOM_NOT_FOUND", "No existe una sala con ese código.");
    }

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id, phase")
      .eq("room_id", room.id)
      .in("phase", ["lobby", "waiting_for_entries"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (gameError) throw new HttpError(500, "GAME_LOOKUP_FAILED", gameError.message);
    if (!game) {
      throw new HttpError(409, "ROOM_NOT_JOINABLE", "Esta sala ya no admite nuevos jugadores.");
    }

    const { data: existingPlayers, error: playersError } = await adminClient
      .from("players")
      .select("id, user_id, seat_index")
      .eq("game_id", game.id);
    if (playersError) throw new HttpError(500, "PLAYERS_LOOKUP_FAILED", playersError.message);

    if ((existingPlayers ?? []).some((p: { user_id: string }) => p.user_id === user.id)) {
      throw new HttpError(409, "ALREADY_JOINED", "Ya tenés un asiento en esta partida.");
    }
    if ((existingPlayers ?? []).length >= room.max_players) {
      throw new HttpError(409, "ROOM_FULL", "La sala ya alcanzó el máximo de jugadores.");
    }

    const nextSeatIndex = (existingPlayers ?? []).length;

    const { data: player, error: insertError } = await adminClient
      .from("players")
      .insert({
        game_id: game.id,
        user_id: user.id,
        display_name: displayName,
        avatar_url: avatarUrl ?? null,
        seat_index: nextSeatIndex,
        status: "waiting",
      })
      .select("id, seat_index")
      .single();
    if (insertError) throw new HttpError(500, "JOIN_FAILED", insertError.message);

    return jsonResponse(
      { ok: true, roomId: room.id, gameId: game.id, playerId: player.id, seatIndex: player.seat_index },
      201,
      origin,
    );
  } catch (err) {
    return errorResponse(err, origin);
  }
});
