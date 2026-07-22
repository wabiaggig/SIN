import { getNextActivePlayer } from "./turnOrder.js";
import type { BettingConfig, Card, GameState, PlayerGameState } from "./types.js";

const HAND_SIZE = 7;

/**
 * Reparte 7 cartas a cada jugador activo y 8 al repartidor. El reparto
 * comienza por el jugador situado a la derecha del repartidor y continúa
 * en ese sentido; el repartidor recibe su octava carta al final (§8).
 * `drawPile` se trata como una pila (el final del array es la próxima
 * carta a repartir), igual que `deck.ts`/`commands.ts`.
 */
export function dealRound(
  players: PlayerGameState[],
  dealerPlayerId: string,
  drawPile: Card[],
): { players: PlayerGameState[]; drawPile: Card[] } {
  const activePlayers = players.filter((player) => player.status === "active");
  if (activePlayers.length < 2) {
    throw new Error("Se necesitan al menos 2 jugadores activos para repartir.");
  }

  const dealOrder: string[] = [];
  let cursor = dealerPlayerId;
  for (let i = 0; i < activePlayers.length - 1; i += 1) {
    const next = getNextActivePlayer(cursor, players);
    dealOrder.push(next.playerId);
    cursor = next.playerId;
  }
  dealOrder.push(dealerPlayerId);

  const hands = new Map<string, Card[]>(dealOrder.map((id) => [id, []]));
  const remaining = [...drawPile];

  for (let round = 0; round < HAND_SIZE; round += 1) {
    for (const playerId of dealOrder) {
      const card = remaining.pop();
      if (!card) throw new Error("El mazo no tiene suficientes cartas para repartir.");
      hands.get(playerId)!.push(card);
    }
  }
  const dealerExtraCard = remaining.pop();
  if (!dealerExtraCard) throw new Error("El mazo no tiene suficientes cartas para repartir.");
  hands.get(dealerPlayerId)!.push(dealerExtraCard);

  const nextPlayers = players.map((player) => {
    const hand = hands.get(player.playerId);
    if (!hand) return player;
    return { ...player, hand, currentRoundPoints: null, hasCompletedFirstTurn: false };
  });

  return { players: nextPlayers, drawPile: remaining };
}

/**
 * Construye el GameState inicial de una nueva ronda a partir del estado
 * de jugadores ya resuelto de la ronda anterior (acumulados, cruces,
 * reingresos) y un mazo ya barajado por el llamador (`shuffleDeck`, sin
 * semilla en producción — ver docs/02-arquitectura.md §7).
 */
export function startNewRound(params: {
  gameId: string;
  roomCode: string;
  players: PlayerGameState[];
  dealerPlayerId: string;
  shuffledDrawPile: Card[];
  roundNumber: number;
  potAmount: number;
  bettingConfig: BettingConfig;
}): GameState {
  const { players: dealtPlayers, drawPile } = dealRound(
    params.players,
    params.dealerPlayerId,
    params.shuffledDrawPile,
  );

  return {
    gameId: params.gameId,
    roomCode: params.roomCode,
    phase: "playing",
    players: dealtPlayers,
    activePlayerId: params.dealerPlayerId,
    dealerPlayerId: params.dealerPlayerId,
    knockerPlayerId: null,
    drawPile,
    discardPile: [],
    tableGroups: [],
    roundNumber: params.roundNumber,
    potAmount: params.potAmount,
    bettingConfig: params.bettingConfig,
    winnerPlayerId: null,
    winType: null,
    currentTurnHasDrawn: false,
    currentTurnHasTakenDiscard: false,
    resolutionOrder: [],
    resolutionIndex: 0,
    roundResults: [],
    awaitingDealerOpeningDiscard: true,
  };
}
