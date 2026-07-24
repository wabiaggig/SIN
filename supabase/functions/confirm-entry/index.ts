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
    const { gameId } = body ?? {};
    if (!gameId || typeof gameId !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Falta gameId.");
    }

    const { data: player, error: playerError } = await adminClient
      .from("players")
      .select("id, status, game_id")
      .eq("game_id", gameId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (playerError) throw new HttpError(500, "PLAYER_LOOKUP_FAILED", playerError.message);
    if (!player) throw new HttpError(403, "NOT_A_PLAYER", "El usuario no tiene un asiento en esta partida.");
    if (player.status !== "waiting") {
      throw new HttpError(409, "ALREADY_CONFIRMED", "Este jugador ya confirmó su entrada.");
    }

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id, room_id, phase, pot_amount")
      .eq("id", gameId)
      .single();
    if (gameError || !game) throw new HttpError(500, "GAME_LOOKUP_FAILED", gameError?.message ?? "no encontrada");

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("initial_entry_amount")
      .eq("id", game.room_id)
      .single();
    if (roomError || !room) throw new HttpError(500, "ROOM_LOOKUP_FAILED", roomError?.message ?? "no encontrada");

    const entryAmount = Number(room.initial_entry_amount);

    const { error: updatePlayerError } = await adminClient
      .from("players")
      .update({ status: "active", total_paid: entryAmount })
      .eq("id", player.id);
    if (updatePlayerError) throw new HttpError(500, "CONFIRM_FAILED", updatePlayerError.message);

    const { error: handError } = await adminClient
      .from("player_hands")
      .upsert({ player_id: player.id, cards: [] });
    if (handError) throw new HttpError(500, "HAND_INIT_FAILED", handError.message);

    const { error: gameUpdateError } = await adminClient
      .from("games")
      .update({
        pot_amount: Number(game.pot_amount) + entryAmount,
        phase: game.phase === "lobby" ? "waiting_for_entries" : game.phase,
      })
      .eq("id", gameId);
    if (gameUpdateError) throw new HttpError(500, "POT_UPDATE_FAILED", gameUpdateError.message);

    return jsonResponse({ ok: true, playerId: player.id, paid: entryAmount }, 200, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
});
