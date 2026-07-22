import { authenticate, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

/**
 * Una sala puede tener varias partidas sucesivas (p.ej. tras un codillo
 * o al terminar una partida y querer jugar otra). create-room solo crea
 * la primera; esta función agrega una nueva fila de `games` a una sala
 * ya existente para que los jugadores vuelvan a unirse/confirmar.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return errorResponse(new HttpError(405, "METHOD_NOT_ALLOWED", "Solo se acepta POST."));
  }

  try {
    const { user, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));
    const { roomId } = body ?? {};
    if (!roomId || typeof roomId !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Falta roomId.");
    }

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("id, host_user_id")
      .eq("id", roomId)
      .single();
    if (roomError || !room) throw new HttpError(404, "ROOM_NOT_FOUND", roomError?.message ?? "no encontrada");
    if (room.host_user_id !== user.id) {
      throw new HttpError(403, "NOT_HOST", "Solo el anfitrión puede iniciar una nueva partida en esta sala.");
    }

    const { data: openGame } = await adminClient
      .from("games")
      .select("id")
      .eq("room_id", roomId)
      .in("phase", ["lobby", "waiting_for_entries", "playing", "resolving_knock", "waiting_for_reentry_decisions"])
      .limit(1)
      .maybeSingle();
    if (openGame) {
      throw new HttpError(409, "GAME_IN_PROGRESS", "Ya hay una partida en curso en esta sala.");
    }

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .insert({ room_id: roomId, phase: "lobby", version: 0 })
      .select("id")
      .single();
    if (gameError) throw new HttpError(500, "GAME_CREATE_FAILED", gameError.message);

    const { error: secretsError } = await adminClient
      .from("game_secrets")
      .insert({ game_id: game.id, draw_pile: [], discard_pile: [] });
    if (secretsError) throw new HttpError(500, "SECRETS_CREATE_FAILED", secretsError.message);

    return jsonResponse({ ok: true, gameId: game.id }, 201);
  } catch (err) {
    return errorResponse(err);
  }
});
