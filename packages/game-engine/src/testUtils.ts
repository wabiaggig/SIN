import type { Card, PlayerGameState, Rank, Suit } from "./types.js";

let counter = 0;

export function card(rank: Rank, suit: Suit | null, deckIndex: 1 | 2 = 1): Card {
  counter += 1;
  return { id: `test-${counter}`, rank, suit, deckIndex };
}

export function joker(deckIndex: 1 | 2 = 1): Card {
  return card("JOKER", null, deckIndex);
}

export function player(overrides: Partial<PlayerGameState> = {}): PlayerGameState {
  counter += 1;
  return {
    playerId: `player-${counter}`,
    displayName: `Player ${counter}`,
    seatIndex: 0,
    status: "active",
    accumulatedPoints: 0,
    currentRoundPoints: null,
    hand: [],
    crossState: "available",
    hasEverFlown: false,
    reentryCount: 0,
    totalPaid: 0,
    totalWon: 0,
    hasCompletedFirstTurn: true,
    ...overrides,
  };
}
