import { createTwoDecks, shuffleDeck, startNewRound } from "../../../packages/game-engine/dist/index.js";
import { authenticate, HttpError } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { serializeOutcome } from "../game-command/state.ts";

/**
 * Reparte la siguiente ronda DENTRO de la misma partida — a diferencia
 * de start-game, que arma la primera ronda de una partida nueva. Cubre
 * §42: si tras un codillo quedan 2+ jugadores, la partida continúa (no
 * termina), y reparte quien el motor ya calculó como dealer_player_id
 * (el golpeador normalmente, o el jugador a la derecha del expulsado si
 * hubo codillo) — no se vuelve a elegir al azar.
 */
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

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .select("id, room_id, phase, version, pot_amount, round_number, dealer_player_id")
      .eq("id", gameId)
      .single();
    if (gameError || !game) throw new HttpError(404, "GAME_NOT_FOUND", gameError?.message ?? "no encontrada");

    if (game.phase !== "waiting_for_reentry_decisions" && game.phase !== "starting_next_round") {
      throw new HttpError(
        409,
        "INVALID_PHASE",
        "Solo se puede repartir la siguiente ronda después de resolver un golpe (§48).",
      );
    }
    if (!game.dealer_player_id) {
      throw new HttpError(500, "NO_DEALER", "La partida no tiene repartidor asignado.");
    }

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("*")
      .eq("id", game.room_id)
      .single();
    if (roomError || !room) throw new HttpError(500, "ROOM_LOOKUP_FAILED", roomError?.message ?? "no encontrada");

    if (room.host_user_id !== user.id) {
      throw new HttpError(403, "NOT_HOST", "Solo el anfitrión puede repartir la siguiente ronda.");
    }

    const { data: playerRows, error: playersError } = await adminClient
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });
    if (playersError) throw new HttpError(500, "PLAYERS_LOOKUP_FAILED", playersError.message);

    const pending = (playerRows ?? []).filter((p: { status: string }) => p.status === "flown_pending_reentry");
    if (pending.length > 0) {
      throw new HttpError(
        409,
        "REENTRY_DECISIONS_PENDING",
        "Todavía hay jugadores sin decidir si reingresan (§34).",
      );
    }

    const activePlayers = (playerRows ?? []).filter((p: { status: string }) => p.status === "active");
    if (activePlayers.length < 2) {
      throw new HttpError(
        409,
        "GAME_SHOULD_BE_FINISHED",
        "Queda un solo jugador sin volar; la partida ya debería estar finalizada (§38).",
      );
    }

    const players = activePlayers.map((p: any) => ({
      playerId: p.id,
      displayName: p.display_name,
      ...(p.avatar_url ? { avatarUrl: p.avatar_url } : {}),
      seatIndex: p.seat_index,
      status: "active" as const,
      accumulatedPoints: p.accumulated_points,
      currentRoundPoints: p.current_round_points,
      hand: [],
      crossState: p.cross_state,
      hasEverFlown: p.has_ever_flown,
      reentryCount: p.reentry_count,
      totalPaid: Number(p.total_paid),
      totalWon: Number(p.total_won),
      hasCompletedFirstTurn: false,
    }));

    const dealerStillActive = players.some((p: { playerId: string }) => p.playerId === game.dealer_player_id);
    if (!dealerStillActive) {
      throw new HttpError(500, "DEALER_NOT_ACTIVE", "El repartidor asignado ya no está activo en la partida.");
    }

    const shuffledDrawPile = shuffleDeck(createTwoDecks());

    const newState = startNewRound({
      gameId: game.id,
      roomCode: room.invite_code,
      players,
      dealerPlayerId: game.dealer_player_id,
      shuffledDrawPile,
      roundNumber: game.round_number + 1,
      potAmount: Number(game.pot_amount),
      bettingConfig: {
        currencyCode: room.currency_code,
        currencySymbol: room.currency_symbol,
        initialEntryAmount: Number(room.initial_entry_amount),
        reentryWithSinAmount: Number(room.reentry_with_sin_amount),
        reentryWithoutSinAmount: Number(room.reentry_without_sin_amount),
        sinBonusAmountPerOpponent: Number(room.sin_bonus_amount_per_opponent),
      },
    });

    const rpcParams = serializeOutcome({
      state: newState,
      events: [{ type: "DECK_SHUFFLED" }, { type: "CARDS_DEALT" }],
    });

    const { data: newVersion, error: rpcError } = await adminClient.rpc("apply_game_command", {
      p_game_id: gameId,
      p_expected_version: game.version,
      ...rpcParams,
    });
    if (rpcError) throw new HttpError(500, "PERSIST_FAILED", rpcError.message);

    return jsonResponse({ ok: true, version: newVersion, dealerPlayerId: game.dealer_player_id }, 200, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
});
