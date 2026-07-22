import { describe, expect, it } from "vitest";
import { canKnock } from "./knock.js";
import { player } from "./testUtils.js";
import type { RoundState } from "./types.js";

function roundState(overrides: Partial<RoundState> = {}): RoundState {
  return {
    activePlayerId: "p1",
    firstRoundCompleted: true,
    hasDrawnThisTurn: false,
    hasTakenDiscardThisTurn: false,
    ...overrides,
  };
}

describe("canKnock", () => {
  it("acumulado 38 + mano 31 → puede golpear", () => {
    const p = player({ playerId: "p1", accumulatedPoints: 38 });
    expect(canKnock(p, 31, roundState()).valid).toBe(true);
  });

  it("acumulado 38 + mano 32 → no puede golpear", () => {
    const p = player({ playerId: "p1", accumulatedPoints: 38 });
    expect(canKnock(p, 32, roundState()).valid).toBe(false);
  });

  it("primera vuelta sin completar → no puede golpear", () => {
    const p = player({ playerId: "p1", accumulatedPoints: 0 });
    expect(canKnock(p, 5, roundState({ firstRoundCompleted: false })).valid).toBe(false);
  });

  it("después de robar → no puede golpear", () => {
    const p = player({ playerId: "p1", accumulatedPoints: 0 });
    expect(canKnock(p, 5, roundState({ hasDrawnThisTurn: true })).valid).toBe(false);
  });

  it("después de tomar el descarte → no puede golpear", () => {
    const p = player({ playerId: "p1", accumulatedPoints: 0 });
    expect(canKnock(p, 5, roundState({ hasTakenDiscardThisTurn: true })).valid).toBe(false);
  });

  it("no es su turno → no puede golpear", () => {
    const p = player({ playerId: "p2", accumulatedPoints: 0 });
    expect(canKnock(p, 5, roundState({ activePlayerId: "p1" })).valid).toBe(false);
  });
});
