import { describe, expect, it } from "vitest";
import { calculateGameSettlement } from "./settlement.js";
import { player } from "./testUtils.js";
import type { BettingConfig, GameState } from "./types.js";

const config: BettingConfig = {
  currencyCode: "PEN",
  currencySymbol: "S/",
  initialEntryAmount: 1,
  reentryWithSinAmount: 1,
  reentryWithoutSinAmount: 0.5,
  sinBonusAmountPerOpponent: 1,
};

function baseGame(overrides: Partial<GameState> = {}): GameState {
  return {
    gameId: "g1",
    roomCode: "ABCD",
    phase: "finished",
    players: [],
    activePlayerId: null,
    dealerPlayerId: "p1",
    knockerPlayerId: null,
    drawPile: [],
    discardPile: [],
    tableGroups: [],
    roundNumber: 5,
    potAmount: 4,
    bettingConfig: config,
    winnerPlayerId: null,
    winType: null,
    ...overrides,
  };
}

describe("calculateGameSettlement", () => {
  it("victoria con SIN: pozo + bono de cada rival (§39, ejemplo con 3 jugadores)", () => {
    const winner = player({ playerId: "winner" });
    const p2 = player({ playerId: "p2" });
    const p3 = player({ playerId: "p3" });
    const game = baseGame({
      players: [winner, p2, p3],
      winnerPlayerId: "winner",
      winType: "sin",
      potAmount: 4,
    });
    const settlement = calculateGameSettlement(game);
    expect(settlement.sinBonusTotal).toBe(2);
    expect(settlement.totalPrize).toBe(6);
    expect(settlement.opponentPayments).toHaveLength(2);
  });

  it("victoria normal: solo se lleva el pozo, sin bono", () => {
    const winner = player({ playerId: "winner" });
    const p2 = player({ playerId: "p2" });
    const game = baseGame({
      players: [winner, p2],
      winnerPlayerId: "winner",
      winType: "normal",
      potAmount: 10,
    });
    const settlement = calculateGameSettlement(game);
    expect(settlement.sinBonusTotal).toBe(0);
    expect(settlement.totalPrize).toBe(10);
    expect(settlement.opponentPayments).toHaveLength(0);
  });
});
