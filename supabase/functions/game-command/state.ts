// deno-lint-ignore-file no-explicit-any
import type {
  BettingConfig,
  CommandOutcome,
  GameState,
  PlayerGameState,
  TableGroup,
} from "../../../packages/game-engine/dist/index.js";

/**
 * Reconstruye el GameState autoritativo (@sin/game-engine) a partir de
 * Postgres. Usa siempre el cliente con service role — es el único que
 * puede leer game_secrets (mazo/descarte completos) y todas las manos.
 */
export async function loadGameState(
  adminClient: any,
  gameId: string,
): Promise<{ state: GameState; version: string; roomId: string }> {
  const { data: game, error: gameError } = await adminClient
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();
  if (gameError || !game) {
    throw new Error(`No se pudo cargar la partida: ${gameError?.message ?? "no encontrada"}`);
  }

  const { data: room, error: roomError } = await adminClient
    .from("rooms")
    .select("*")
    .eq("id", game.room_id)
    .single();
  if (roomError || !room) {
    throw new Error(`No se pudo cargar la sala: ${roomError?.message ?? "no encontrada"}`);
  }

  const { data: playerRows, error: playersError } = await adminClient
    .from("players")
    .select("*")
    .eq("game_id", gameId)
    .order("seat_index", { ascending: true });
  if (playersError) throw new Error(`No se pudieron cargar los jugadores: ${playersError.message}`);

  const playerIds = (playerRows ?? []).map((p: any) => p.id);

  const { data: handRows, error: handsError } = await adminClient
    .from("player_hands")
    .select("player_id, cards")
    .in("player_id", playerIds);
  if (handsError) throw new Error(`No se pudieron cargar las manos: ${handsError.message}`);
  const handByPlayerId = new Map<string, any[]>((handRows ?? []).map((h: any) => [h.player_id, h.cards ?? []]));

  const { data: secrets, error: secretsError } = await adminClient
    .from("game_secrets")
    .select("draw_pile, discard_pile")
    .eq("game_id", gameId)
    .single();
  if (secretsError || !secrets) {
    throw new Error(`No se pudo cargar el mazo: ${secretsError?.message ?? "no encontrado"}`);
  }

  const { data: groupRows, error: groupsError } = await adminClient
    .from("table_groups")
    .select("*")
    .eq("game_id", gameId);
  if (groupsError) throw new Error(`No se pudieron cargar los grupos: ${groupsError.message}`);

  const groupIds = (groupRows ?? []).map((g: any) => g.id);
  const { data: groupCardRows, error: groupCardsError } = groupIds.length
    ? await adminClient
        .from("table_group_cards")
        .select("*")
        .in("table_group_id", groupIds)
        .order("position", { ascending: true })
    : { data: [], error: null };
  if (groupCardsError) throw new Error(`No se pudieron cargar las cartas de mesa: ${groupCardsError.message}`);

  const cardsByGroupId = new Map<string, any[]>();
  for (const row of groupCardRows ?? []) {
    const list = cardsByGroupId.get(row.table_group_id) ?? [];
    list.push({
      card: row.card,
      ownerPlayerId: row.owner_player_id,
      ...(row.joker_represents_rank ? { jokerRepresentsRank: row.joker_represents_rank } : {}),
    });
    cardsByGroupId.set(row.table_group_id, list);
  }

  const tableGroups: TableGroup[] = (groupRows ?? []).map((g: any) => ({
    id: g.id,
    type: g.type,
    createdByPlayerId: g.created_by_player_id,
    locked: g.locked,
    cards: cardsByGroupId.get(g.id) ?? [],
  }));

  const players: PlayerGameState[] = (playerRows ?? []).map((p: any) => ({
    playerId: p.id,
    displayName: p.display_name,
    ...(p.avatar_url ? { avatarUrl: p.avatar_url } : {}),
    seatIndex: p.seat_index,
    status: p.status,
    accumulatedPoints: p.accumulated_points,
    currentRoundPoints: p.current_round_points,
    hand: handByPlayerId.get(p.id) ?? [],
    crossState: p.cross_state,
    hasEverFlown: p.has_ever_flown,
    reentryCount: p.reentry_count,
    totalPaid: Number(p.total_paid),
    totalWon: Number(p.total_won),
    hasCompletedFirstTurn: p.has_completed_first_turn,
  }));

  const bettingConfig: BettingConfig = {
    currencyCode: room.currency_code,
    currencySymbol: room.currency_symbol,
    initialEntryAmount: Number(room.initial_entry_amount),
    reentryWithSinAmount: Number(room.reentry_with_sin_amount),
    reentryWithoutSinAmount: Number(room.reentry_without_sin_amount),
    sinBonusAmountPerOpponent: Number(room.sin_bonus_amount_per_opponent),
  };

  const state: GameState = {
    gameId: game.id,
    roomCode: room.invite_code,
    phase: game.phase,
    players,
    activePlayerId: game.active_player_id,
    dealerPlayerId: game.dealer_player_id,
    knockerPlayerId: game.knocker_player_id,
    drawPile: secrets.draw_pile ?? [],
    discardPile: secrets.discard_pile ?? [],
    tableGroups,
    roundNumber: game.round_number,
    potAmount: Number(game.pot_amount),
    bettingConfig,
    winnerPlayerId: game.winner_player_id,
    winType: game.win_type,
    currentTurnHasDrawn: game.current_turn_has_drawn,
    currentTurnHasTakenDiscard: game.current_turn_has_taken_discard,
    resolutionOrder: game.resolution_order ?? [],
    resolutionIndex: game.resolution_index,
    roundResults: game.round_results ?? [],
    awaitingDealerOpeningDiscard: game.awaiting_dealer_opening_discard ?? false,
  };

  return { state, version: game.version, roomId: game.room_id };
}

/** Serializa un CommandOutcome a los parámetros jsonb de apply_game_command. */
export function serializeOutcome(outcome: CommandOutcome) {
  const { state, events } = outcome;

  const p_game = {
    phase: state.phase,
    roundNumber: state.roundNumber,
    activePlayerId: state.activePlayerId,
    dealerPlayerId: state.dealerPlayerId,
    knockerPlayerId: state.knockerPlayerId,
    potAmount: state.potAmount,
    winnerPlayerId: state.winnerPlayerId,
    winType: state.winType,
    currentTurnHasDrawn: state.currentTurnHasDrawn,
    currentTurnHasTakenDiscard: state.currentTurnHasTakenDiscard,
    resolutionOrder: state.resolutionOrder,
    resolutionIndex: state.resolutionIndex,
    roundResults: state.roundResults,
    drawPileCount: state.drawPile.length,
    discardTopCard: state.discardPile.length > 0 ? state.discardPile[state.discardPile.length - 1] : null,
    awaitingDealerOpeningDiscard: state.awaitingDealerOpeningDiscard,
  };

  const p_players = state.players.map((p) => ({
    id: p.playerId,
    status: p.status,
    accumulatedPoints: p.accumulatedPoints,
    currentRoundPoints: p.currentRoundPoints,
    crossState: p.crossState,
    hasEverFlown: p.hasEverFlown,
    reentryCount: p.reentryCount,
    totalPaid: p.totalPaid,
    totalWon: p.totalWon,
    hasCompletedFirstTurn: p.hasCompletedFirstTurn,
    handCount: p.hand.length,
  }));

  const p_hands = state.players.map((p) => ({ playerId: p.playerId, cards: p.hand }));

  const p_table_groups = state.tableGroups.map((g) => ({
    id: g.id,
    type: g.type,
    createdByPlayerId: g.createdByPlayerId,
    locked: g.locked,
    cards: g.cards.map((tc) => ({
      card: tc.card,
      ownerPlayerId: tc.ownerPlayerId,
      jokerRepresentsRank: tc.jokerRepresentsRank ?? null,
    })),
  }));

  const p_secrets = { drawPile: state.drawPile, discardPile: state.discardPile };

  return { p_game, p_players, p_hands, p_table_groups, p_secrets, p_events: events };
}
