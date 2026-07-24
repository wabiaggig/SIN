import { createTwoDecks, shuffleDeck, startNewRound } from "../../../packages/game-engine/dist/index.js";
import { authenticate, HttpError } from "../_shared/auth.ts";
import { buildCorsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { serializeOutcome } from "../game-command/state.ts";

const MIN_PLAYERS = 3;

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
      .select("id, room_id, phase, version, pot_amount")
      .eq("id", gameId)
      .single();
    if (gameError || !game) throw new HttpError(404, "GAME_NOT_FOUND", gameError?.message ?? "no encontrada");

    if (game.phase !== "lobby" && game.phase !== "waiting_for_entries") {
      throw new HttpError(409, "GAME_ALREADY_STARTED", "Esta partida ya fue iniciada.");
    }

    const { data: room, error: roomError } = await adminClient
      .from("rooms")
      .select("*")
      .eq("id", game.room_id)
      .single();
    if (roomError || !room) throw new HttpError(500, "ROOM_LOOKUP_FAILED", roomError?.message ?? "no encontrada");

    if (room.host_user_id !== user.id) {
      throw new HttpError(403, "NOT_HOST", "Solo el anfitrión puede iniciar la partida.");
    }

    const { data: playerRows, error: playersError } = await adminClient
      .from("players")
      .select("*")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });
    if (playersError) throw new HttpError(500, "PLAYERS_LOOKUP_FAILED", playersError.message);

    const activePlayers = (playerRows ?? []).filter((p: { status: string }) => p.status === "active");
    if (activePlayers.length < MIN_PLAYERS) {
      throw new HttpError(
        409,
        "NOT_ENOUGH_PLAYERS",
        `Se necesitan al menos ${MIN_PLAYERS} jugadores que hayan confirmado su entrada (§3).`,
      );
    }

    // Selección aleatoria del repartidor (§7 — una de las opciones documentadas).
    const dealerIndex = crypto.getRandomValues(new Uint32Array(1))[0] % activePlayers.length;
    const dealerPlayerId = activePlayers[dealerIndex].id;

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

    // Barajado real, sin semilla — el servidor es la única autoridad
    // sobre el orden del mazo (§7, docs/01-analisis-funcional.md §7.3).
    const shuffledDrawPile = shuffleDeck(createTwoDecks());

    const newState = startNewRound({
      gameId: game.id,
      roomCode: room.invite_code,
      players,
      dealerPlayerId,
      shuffledDrawPile,
      roundNumber: 1,
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

    // Liquidación de la deuda por codillo (§41): el deudor paga la entrada
    // de cada jugador que participa en esta partida (incluida la suya
    // propia si decidió jugar) — en ambos casos, entryAmount * cantidad de
    // activePlayers, que es exactamente como lo ilustra el ejemplo del
    // reglamento. Se salda al arrancar y se limpia el campo en la sala.
    let codilloSettlement: { debtorUserId: string; amount: number } | null = null;
    if (room.codillo_debtor_user_id) {
      const amount = Number(room.initial_entry_amount) * activePlayers.length;
      codilloSettlement = { debtorUserId: room.codillo_debtor_user_id, amount };
      const { error: clearDebtError } = await adminClient
        .from("rooms")
        .update({ codillo_debtor_user_id: null })
        .eq("id", room.id);
      if (clearDebtError) throw new HttpError(500, "DEBT_SETTLEMENT_FAILED", clearDebtError.message);
    }

    return jsonResponse({ ok: true, version: newVersion, dealerPlayerId, codilloSettlement }, 200, origin);
  } catch (err) {
    return errorResponse(err, origin);
  }
});
