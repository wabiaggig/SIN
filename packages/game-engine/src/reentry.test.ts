import { describe, expect, it } from "vitest";
import { calculateReentryPrice, calculateReentryScore } from "./reentry.js";
import { player } from "./testUtils.js";
import type { BettingConfig } from "./types.js";

const config: BettingConfig = {
  currencyCode: "PEN",
  currencySymbol: "S/",
  initialEntryAmount: 1,
  reentryWithSinAmount: 1,
  reentryWithoutSinAmount: 0.5,
  sinBonusAmountPerOpponent: 1,
};

describe("calculateReentryScore", () => {
  it("activos con 20, 47 y 35 → reingreso en 47", () => {
    const players = [
      player({ accumulatedPoints: 20 }),
      player({ accumulatedPoints: 47 }),
      player({ accumulatedPoints: 35 }),
    ];
    expect(calculateReentryScore(players)).toBe(47);
  });
});

describe("calculateReentryPrice", () => {
  it("existe SIN → paga el monto mayor", () => {
    const players = [
      player({ crossState: "available", hasEverFlown: false, status: "active" }),
      player({ crossState: "used", hasEverFlown: false, status: "active" }),
    ];
    expect(calculateReentryPrice(players, config)).toBe(1);
  });

  it("no existe SIN → paga el monto menor", () => {
    const players = [
      player({ crossState: "used", hasEverFlown: false, status: "active" }),
      player({ crossState: "available", hasEverFlown: true, status: "active" }),
    ];
    expect(calculateReentryPrice(players, config)).toBe(0.5);
  });

  it("jugador expulsado por codillo no cuenta para el chequeo de SIN", () => {
    const players = [
      player({ crossState: "available", hasEverFlown: false, status: "codillo_eliminated" }),
      player({ crossState: "used", hasEverFlown: false, status: "active" }),
    ];
    expect(calculateReentryPrice(players, config)).toBe(0.5);
  });
});
