import { canKnock } from "./knock.js";
import { canUseCross } from "./cross.js";
import { detectCodillo } from "./codillo.js";
import { shuffleDeck } from "./deck.js";
import { detectFlownPlayers } from "./flying.js";
import { validateGroup, validateSameRankGroup, validateStraightGroup } from "./groups.js";
import { calculateHandPoints } from "./points.js";
import { calculateReentryPrice, calculateReentryScore } from "./reentry.js";
import { validateRoyal } from "./royal.js";
import { hasSin } from "./sin.js";
import { getNextActivePlayer } from "./turnOrder.js";
import {
  err,
  ok,
  type Card,
  type CommandOutcome,
  type GameCommand,
  type GameEvent,
  type GameState,
  type PlayerGameState,
  type Result,
  type RoundState,
  type TableGroup,
} from "./types.js";

function findPlayer(state: GameState, playerId: string): PlayerGameState | undefined {
  return state.players.find((player) => player.playerId === playerId);
}

function updatePlayer(
  state: GameState,
  playerId: string,
  updater: (player: PlayerGameState) => PlayerGameState,
): GameState {
  return {
    ...state,
    players: state.players.map((player) => (player.playerId === playerId ? updater(player) : player)),
  };
}

function cardsFromHand(hand: Card[], cardIds: string[]): Card[] | null {
  const found: Card[] = [];
  for (const id of cardIds) {
    const card = hand.find((c) => c.id === id);
    if (!card) {
      return null;
    }
    found.push(card);
  }
  return found;
}

function removeCards(hand: Card[], cardIds: string[]): Card[] {
  const idSet = new Set(cardIds);
  return hand.filter((card) => !idSet.has(card.id));
}

function deriveRoundState(state: GameState): RoundState {
  const activePlayers = state.players.filter((player) => player.status === "active");
  return {
    activePlayerId: state.activePlayerId ?? "",
    firstRoundCompleted: activePlayers.every((player) => player.hasCompletedFirstTurn),
    hasDrawnThisTurn: state.currentTurnHasDrawn,
    hasTakenDiscardThisTurn: state.currentTurnHasTakenDiscard,
  };
}

function requireActiveTurn(state: GameState, playerId: string): Result<true> {
  if (state.activePlayerId !== playerId) {
    return err("NOT_YOUR_TURN", "No es el turno de este jugador.");
  }
  return ok(true);
}

/** Recicla el descarte si el mazo está vacío (§25). */
function recycleIfNeeded(state: GameState): { drawPile: Card[]; discardPile: Card[]; recycled: boolean } {
  if (state.drawPile.length > 0 || state.discardPile.length === 0) {
    return { drawPile: state.drawPile, discardPile: state.discardPile, recycled: false };
  }
  const top = state.discardPile[state.discardPile.length - 1]!;
  const rest = state.discardPile.slice(0, -1);
  return { drawPile: shuffleDeck(rest), discardPile: [top], recycled: true };
}

/**
 * Termina el turno del jugador activo y avanza al siguiente (§23).
 * `countsAsFirstTurn=false` es exclusivamente para el descarte inicial
 * del repartidor, que NO habilita el golpe por sí solo (§10).
 */
function endTurn(state: GameState, playerId: string, countsAsFirstTurn = true): GameState {
  const withCompletedFlag = countsAsFirstTurn
    ? updatePlayer(state, playerId, (player) => ({ ...player, hasCompletedFirstTurn: true }))
    : state;
  const next = getNextActivePlayer(playerId, withCompletedFlag.players);
  return {
    ...withCompletedFlag,
    activePlayerId: next.playerId,
    currentTurnHasDrawn: false,
    currentTurnHasTakenDiscard: false,
  };
}

function handleDrawCard(state: GameState, playerId: string): Result<CommandOutcome> {
  const turnCheck = requireActiveTurn(state, playerId);
  if (!turnCheck.ok) return turnCheck;
  if (state.phase !== "playing") {
    return err("INVALID_PHASE", "Solo se puede robar durante la fase de juego normal.");
  }
  if (state.currentTurnHasDrawn || state.currentTurnHasTakenDiscard) {
    return err("ACTION_ALREADY_TAKEN", "Ya se eligió una acción principal en este turno.");
  }

  const { drawPile, discardPile, recycled } = recycleIfNeeded(state);
  if (drawPile.length === 0) {
    return err("DECK_EMPTY", "No quedan cartas para robar.");
  }

  const drawnCard = drawPile[drawPile.length - 1]!;
  const remainingDrawPile = drawPile.slice(0, -1);

  const nextState = updatePlayer(
    { ...state, drawPile: remainingDrawPile, discardPile, currentTurnHasDrawn: true },
    playerId,
    (player) => ({ ...player, hand: [...player.hand, drawnCard] }),
  );

  const events: GameEvent[] = [];
  if (recycled) events.push({ type: "DECK_RECYCLED" });
  events.push({ type: "CARD_DRAWN", playerId });

  return ok({ state: nextState, events });
}

function handleTakeDiscard(
  state: GameState,
  playerId: string,
  groupCardIds: string[],
): Result<CommandOutcome> {
  const turnCheck = requireActiveTurn(state, playerId);
  if (!turnCheck.ok) return turnCheck;
  if (state.phase !== "playing") {
    return err("INVALID_PHASE", "Solo se puede tomar el descarte durante la fase de juego normal.");
  }
  if (state.currentTurnHasDrawn || state.currentTurnHasTakenDiscard) {
    return err("ACTION_ALREADY_TAKEN", "Ya se eligió una acción principal en este turno.");
  }
  if (state.discardPile.length === 0) {
    return err("DISCARD_EMPTY", "No hay carta en el descarte.");
  }

  const player = findPlayer(state, playerId);
  if (!player) return err("PLAYER_NOT_FOUND", "Jugador no encontrado.");

  const topDiscard = state.discardPile[state.discardPile.length - 1]!;
  if (!groupCardIds.includes(topDiscard.id)) {
    return err("MUST_USE_TOP_DISCARD", "El grupo debe incluir la carta superior del descarte.");
  }

  const ownCardIds = groupCardIds.filter((id) => id !== topDiscard.id);
  const ownCards = cardsFromHand(player.hand, ownCardIds);
  if (!ownCards) {
    return err("CARD_NOT_IN_HAND", "Alguna de las cartas indicadas no está en la mano del jugador.");
  }

  const proposedGroup = [...ownCards, topDiscard];
  const validation = validateGroup(proposedGroup);
  if (!validation.valid) {
    return err("INVALID_GROUP", validation.reason);
  }

  const newGroup: TableGroup = {
    id: crypto.randomUUID(),
    type: validateSameRankGroup(proposedGroup).valid ? "same_rank" : "straight",
    cards: proposedGroup.map((card) => ({ card, ownerPlayerId: playerId })),
    createdByPlayerId: playerId,
    locked: false,
  };

  const nextState = updatePlayer(
    {
      ...state,
      discardPile: state.discardPile.slice(0, -1),
      currentTurnHasTakenDiscard: true,
      tableGroups: [...state.tableGroups, newGroup],
    },
    playerId,
    (p) => ({ ...p, hand: removeCards(p.hand, ownCardIds) }),
  );

  return ok({
    state: nextState,
    events: [
      { type: "DISCARD_TAKEN", playerId },
      { type: "GROUP_LAID_DOWN", playerId, groupId: newGroup.id },
    ],
  });
}

function inResolutionOrPlayingTurn(state: GameState, playerId: string): Result<true> {
  if (state.phase !== "playing" && state.phase !== "resolving_knock") {
    return err("INVALID_PHASE", "Solo se puede bajar/enchufar durante el turno o la resolución del golpe.");
  }
  return requireActiveTurn(state, playerId);
}

function handleLayDownGroup(state: GameState, playerId: string, cardIds: string[]): Result<CommandOutcome> {
  const check = inResolutionOrPlayingTurn(state, playerId);
  if (!check.ok) return check;
  if (state.phase === "playing" && !state.currentTurnHasDrawn && !state.currentTurnHasTakenDiscard) {
    return err("MUST_ACT_FIRST", "Debe robar o tomar el descarte antes de bajarse.");
  }

  const player = findPlayer(state, playerId)!;
  const cards = cardsFromHand(player.hand, cardIds);
  if (!cards) {
    return err("CARD_NOT_IN_HAND", "Alguna de las cartas indicadas no está en la mano del jugador.");
  }

  const validation = validateGroup(cards);
  if (!validation.valid) {
    return err("INVALID_GROUP", validation.reason);
  }

  const newGroup: TableGroup = {
    id: crypto.randomUUID(),
    type: validateSameRankGroup(cards).valid ? "same_rank" : "straight",
    cards: cards.map((card) => ({ card, ownerPlayerId: playerId })),
    createdByPlayerId: playerId,
    locked: false,
  };

  let nextState = updatePlayer({ ...state, tableGroups: [...state.tableGroups, newGroup] }, playerId, (p) => ({
    ...p,
    hand: removeCards(p.hand, cardIds),
  }));

  const events: GameEvent[] = [{ type: "GROUP_LAID_DOWN", playerId, groupId: newGroup.id }];

  if (state.phase === "playing" && findPlayer(nextState, playerId)!.hand.length === 0) {
    nextState = endTurn(nextState, playerId);
  }

  return ok({ state: nextState, events });
}

function handleAttachCard(
  state: GameState,
  playerId: string,
  groupId: string,
  cardId: string,
): Result<CommandOutcome> {
  const check = inResolutionOrPlayingTurn(state, playerId);
  if (!check.ok) return check;
  if (state.phase === "playing" && !state.currentTurnHasDrawn && !state.currentTurnHasTakenDiscard) {
    return err("MUST_ACT_FIRST", "Debe robar o tomar el descarte antes de enchufar.");
  }

  const player = findPlayer(state, playerId)!;
  const card = player.hand.find((c) => c.id === cardId);
  if (!card) {
    return err("CARD_NOT_IN_HAND", "La carta no está en la mano del jugador.");
  }

  const group = state.tableGroups.find((g) => g.id === groupId);
  if (!group) {
    return err("GROUP_NOT_FOUND", "El grupo indicado no existe.");
  }
  if (group.locked) {
    return err("GROUP_LOCKED", "El grupo no admite más cartas.");
  }

  const existingCards = group.cards.map((tc) => tc.card);

  let insertAt: "start" | "end" | null = null;
  if (group.type === "same_rank") {
    const validation = validateSameRankGroup([...existingCards, card]);
    if (validation.valid) insertAt = "end";
  } else {
    const appended = validateStraightGroup([...existingCards, card]);
    const prepended = validateStraightGroup([card, ...existingCards]);
    if (appended.valid) insertAt = "end";
    else if (prepended.valid) insertAt = "start";
  }

  if (!insertAt) {
    return err("INVALID_ATTACH", "La carta no puede enchufarse en este grupo.");
  }

  const newTableCard = { card, ownerPlayerId: playerId };
  const updatedGroups = state.tableGroups.map((g) => {
    if (g.id !== groupId) return g;
    return {
      ...g,
      cards: insertAt === "start" ? [newTableCard, ...g.cards] : [...g.cards, newTableCard],
    };
  });

  let nextState = updatePlayer({ ...state, tableGroups: updatedGroups }, playerId, (p) => ({
    ...p,
    hand: removeCards(p.hand, [cardId]),
  }));

  const events: GameEvent[] = [{ type: "CARD_ATTACHED", playerId, groupId }];

  if (state.phase === "playing" && findPlayer(nextState, playerId)!.hand.length === 0) {
    nextState = endTurn(nextState, playerId);
  }

  return ok({ state: nextState, events });
}

function handleDiscardCard(state: GameState, playerId: string, cardId: string): Result<CommandOutcome> {
  const turnCheck = requireActiveTurn(state, playerId);
  if (!turnCheck.ok) return turnCheck;
  if (state.phase !== "playing") {
    return err("INVALID_PHASE", "Solo se puede descartar durante la fase de juego normal.");
  }

  const isDealerOpeningDiscard = state.awaitingDealerOpeningDiscard && playerId === state.dealerPlayerId;
  if (!isDealerOpeningDiscard && !state.currentTurnHasDrawn && !state.currentTurnHasTakenDiscard) {
    return err("MUST_ACT_FIRST", "Debe robar o tomar el descarte antes de descartar.");
  }

  const player = findPlayer(state, playerId)!;
  if (!player.hand.some((c) => c.id === cardId)) {
    return err("CARD_NOT_IN_HAND", "La carta no está en la mano del jugador.");
  }

  const card = player.hand.find((c) => c.id === cardId)!;
  const stateWithoutCard = updatePlayer(
    {
      ...state,
      discardPile: [...state.discardPile, card],
      awaitingDealerOpeningDiscard: isDealerOpeningDiscard ? false : state.awaitingDealerOpeningDiscard,
    },
    playerId,
    (p) => ({ ...p, hand: removeCards(p.hand, [cardId]) }),
  );

  // El descarte inicial del repartidor no cuenta como turno completo (§10).
  const nextState = endTurn(stateWithoutCard, playerId, !isDealerOpeningDiscard);

  return ok({ state: nextState, events: [{ type: "CARD_DISCARDED", playerId }] });
}

function handleKnock(state: GameState, playerId: string): Result<CommandOutcome> {
  if (state.phase !== "playing") {
    return err("INVALID_PHASE", "Solo se puede golpear durante la fase de juego normal.");
  }
  const player = findPlayer(state, playerId);
  if (!player) return err("PLAYER_NOT_FOUND", "Jugador no encontrado.");

  const handPoints = calculateHandPoints(player.hand);
  const validation = canKnock(player, handPoints, deriveRoundState(state));
  if (!validation.valid) {
    return err("CANNOT_KNOCK", validation.reason);
  }

  const activePlayers = state.players.filter((p) => p.status === "active");
  const order: string[] = [];
  let cursor = playerId;
  for (let i = 0; i < activePlayers.length - 1; i += 1) {
    const next = getNextActivePlayer(cursor, state.players);
    order.push(next.playerId);
    cursor = next.playerId;
  }
  order.push(playerId);

  const nextState: GameState = {
    ...state,
    phase: "resolving_knock",
    knockerPlayerId: playerId,
    resolutionOrder: order,
    resolutionIndex: 0,
    activePlayerId: order[0] ?? playerId,
    roundResults: [],
  };

  return ok({ state: nextState, events: [{ type: "KNOCK_DECLARED", playerId }] });
}

/**
 * Cierra el resultado de ronda del jugador que está resolviendo y avanza.
 * `roundPoints` es lo que se acumula (0 si se cruzó); `realPoints` es el
 * puntaje real de la mano, usado solo para la comparación de codillo.
 */
function advanceResolution(
  state: GameState,
  playerId: string,
  roundPoints: number,
  realPoints: number,
): CommandOutcome {
  const withResult: GameState = {
    ...state,
    roundResults: [...state.roundResults, { playerId, roundPoints, realPoints }],
  };
  const nextIndex = withResult.resolutionIndex + 1;

  if (nextIndex < withResult.resolutionOrder.length) {
    return {
      state: {
        ...withResult,
        resolutionIndex: nextIndex,
        activePlayerId: withResult.resolutionOrder[nextIndex]!,
      },
      events: [],
    };
  }

  return finishResolution(withResult);
}

/** Aplica codillo, vuelos y determina si la partida terminó (§28, §33, §38, §40-42). */
function finishResolution(state: GameState): CommandOutcome {
  const knockerId = state.knockerPlayerId!;
  const flownIds = detectFlownPlayers(
    state.players.filter((p) => p.status === "active"),
    state.roundResults,
  );
  const codillo = detectCodillo(knockerId, state.roundResults, flownIds);

  const pointsByPlayer = new Map(state.roundResults.map((r) => [r.playerId, r.roundPoints]));

  let players = state.players.map((player) => {
    const roundPoints = pointsByPlayer.get(player.playerId);
    if (roundPoints === undefined) return player;

    if (codillo && player.playerId === knockerId) {
      return { ...player, status: "codillo_eliminated" as const, currentRoundPoints: null };
    }

    const accumulatedPoints = player.accumulatedPoints + roundPoints;
    const flew = flownIds.includes(player.playerId);

    if (flew) {
      return {
        ...player,
        accumulatedPoints,
        currentRoundPoints: roundPoints,
        hasEverFlown: true,
        status: "flown_pending_reentry" as const,
        crossState: player.crossState === "available" ? ("lost_by_flying" as const) : player.crossState,
      };
    }

    return { ...player, accumulatedPoints, currentRoundPoints: roundPoints, status: "active" as const };
  });

  const events: GameEvent[] = [];
  if (codillo) events.push({ type: "CODILLO_DECLARED", playerId: knockerId });
  for (const id of flownIds) events.push({ type: "PLAYER_FLEW", playerId: id });

  const nonFlownActive = players.filter((p) => p.status === "active");

  let phase: GameState["phase"] = "waiting_for_reentry_decisions";
  let winnerPlayerId: string | null = null;
  let winType: GameState["winType"] = null;
  let dealerPlayerId = codillo ? getNextActivePlayer(knockerId, players).playerId : knockerId;

  if (nonFlownActive.length === 1) {
    const winner = nonFlownActive[0]!;
    players = players.map((p) =>
      p.playerId === winner.playerId
        ? { ...p, status: "winner" as const }
        : p.status === "flown_pending_reentry"
          ? { ...p, status: "eliminated" as const }
          : p,
    );
    phase = "finished";
    winnerPlayerId = winner.playerId;
    winType = hasSin(winner) && winner.reentryCount === 0 ? "sin" : "normal";
    events.push({ type: "GAME_FINISHED", winnerPlayerId: winner.playerId });
  }

  return {
    state: {
      ...state,
      players,
      phase,
      activePlayerId: null,
      dealerPlayerId,
      winnerPlayerId,
      winType,
    },
    events,
  };
}

function handleUseCross(state: GameState, playerId: string): Result<CommandOutcome> {
  if (state.phase !== "resolving_knock") {
    return err("INVALID_PHASE", "Solo se puede usar la cruz durante la resolución del golpe.");
  }
  const turnCheck = requireActiveTurn(state, playerId);
  if (!turnCheck.ok) return turnCheck;

  const player = findPlayer(state, playerId)!;
  const roundPoints = calculateHandPoints(player.hand);
  const isKnocker = playerId === state.knockerPlayerId;
  const validation = canUseCross(player, roundPoints, isKnocker);
  if (!validation.valid) {
    return err("CANNOT_USE_CROSS", validation.reason);
  }

  const stateWithCrossUsed = updatePlayer(state, playerId, (p) => ({ ...p, crossState: "used" }));
  const resolutionOutcome = advanceResolution(stateWithCrossUsed, playerId, 0, roundPoints);

  return ok({
    state: resolutionOutcome.state,
    events: [{ type: "CROSS_USED", playerId }, ...resolutionOutcome.events],
  });
}

function handleConfirmResolution(state: GameState, playerId: string): Result<CommandOutcome> {
  if (state.phase !== "resolving_knock") {
    return err("INVALID_PHASE", "No hay una resolución de golpe en curso.");
  }
  const turnCheck = requireActiveTurn(state, playerId);
  if (!turnCheck.ok) return turnCheck;

  const player = findPlayer(state, playerId)!;
  const roundPoints = calculateHandPoints(player.hand);
  const resolutionOutcome = advanceResolution(state, playerId, roundPoints, roundPoints);

  return ok(resolutionOutcome);
}

function handleDeclareRoyal(state: GameState, playerId: string): Result<CommandOutcome> {
  const player = findPlayer(state, playerId);
  if (!player) return err("PLAYER_NOT_FOUND", "Jugador no encontrado.");
  if (player.status !== "active") {
    return err("PLAYER_NOT_ACTIVE", "Solo un jugador activo puede declarar royal.");
  }

  const validation = validateRoyal(player.hand);
  if (!validation.valid) {
    return err("INVALID_ROYAL", validation.reason);
  }

  const players = state.players.map((p) => (p.playerId === playerId ? { ...p, status: "winner" as const } : p));
  const winType = hasSin(player) && player.reentryCount === 0 ? "royal_with_sin" : "royal";

  const nextState: GameState = {
    ...state,
    players,
    phase: "finished",
    winnerPlayerId: playerId,
    winType,
  };

  return ok({
    state: nextState,
    events: [
      { type: "ROYAL_DECLARED", playerId },
      { type: "GAME_FINISHED", winnerPlayerId: playerId },
    ],
  });
}

function handleReenter(state: GameState, playerId: string): Result<CommandOutcome> {
  if (state.phase !== "waiting_for_reentry_decisions") {
    return err("INVALID_PHASE", "No se puede reingresar en este momento.");
  }
  const player = findPlayer(state, playerId);
  if (!player) return err("PLAYER_NOT_FOUND", "Jugador no encontrado.");
  if (player.status !== "flown_pending_reentry") {
    return err("CANNOT_REENTER", "El jugador no está en condición de reingresar.");
  }

  const nonFlownActive = state.players.filter((p) => p.status === "active");
  if (nonFlownActive.length < 2) {
    return err("REENTRY_NOT_ALLOWED", "Ya hay un ganador; no se permite reingresar.");
  }

  const score = calculateReentryScore(nonFlownActive);
  const price = calculateReentryPrice(state.players, state.bettingConfig);

  const nextState = updatePlayer(
    { ...state, potAmount: state.potAmount + price },
    playerId,
    (p) => ({
      ...p,
      status: "active",
      accumulatedPoints: score,
      reentryCount: p.reentryCount + 1,
      totalPaid: p.totalPaid + price,
    }),
  );

  return ok({ state: nextState, events: [{ type: "PLAYER_REENTERED", playerId, score }] });
}

function handleSingScoreboard(state: GameState, playerId: string): Result<CommandOutcome> {
  return ok({ state, events: [{ type: "SCOREBOARD_SUNG", playerId }] });
}

export function processCommand(state: GameState, command: GameCommand): Result<CommandOutcome> {
  switch (command.type) {
    case "DRAW_CARD":
      return handleDrawCard(state, command.playerId);
    case "TAKE_DISCARD":
      return handleTakeDiscard(state, command.playerId, command.groupCardIds);
    case "LAY_DOWN_GROUP":
      return handleLayDownGroup(state, command.playerId, command.cardIds);
    case "ATTACH_CARD":
      return handleAttachCard(state, command.playerId, command.groupId, command.cardId);
    case "DISCARD_CARD":
      return handleDiscardCard(state, command.playerId, command.cardId);
    case "KNOCK":
      return handleKnock(state, command.playerId);
    case "USE_CROSS":
      return handleUseCross(state, command.playerId);
    case "CONFIRM_RESOLUTION":
      return handleConfirmResolution(state, command.playerId);
    case "DECLARE_ROYAL":
      return handleDeclareRoyal(state, command.playerId);
    case "REENTER":
      return handleReenter(state, command.playerId);
    case "SING_SCOREBOARD":
      return handleSingScoreboard(state, command.playerId);
    default: {
      const exhaustive: never = command;
      return exhaustive;
    }
  }
}
