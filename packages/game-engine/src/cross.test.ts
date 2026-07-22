import { describe, expect, it } from "vitest";
import { canUseCross } from "./cross.js";
import { player } from "./testUtils.js";

describe("canUseCross", () => {
  it("acumulado 60 + ronda 9 → puede cruzarse", () => {
    const p = player({ accumulatedPoints: 60, crossState: "available" });
    expect(canUseCross(p, 9).valid).toBe(true);
  });

  it("acumulado 60 + ronda 10 → no puede cruzarse (vuela)", () => {
    const p = player({ accumulatedPoints: 60, crossState: "available" });
    expect(canUseCross(p, 10).valid).toBe(false);
  });

  it("ronda 0 → no puede cruzarse", () => {
    const p = player({ accumulatedPoints: 10, crossState: "available" });
    expect(canUseCross(p, 0).valid).toBe(false);
  });

  it("golpeador → no puede cruzarse", () => {
    const p = player({ accumulatedPoints: 10, crossState: "available" });
    expect(canUseCross(p, 5, true).valid).toBe(false);
  });

  it("cruz ya utilizada → no puede cruzarse", () => {
    const p = player({ accumulatedPoints: 10, crossState: "used" });
    expect(canUseCross(p, 5).valid).toBe(false);
  });

  it("jugador que ya voló (lost_by_flying) → no puede cruzarse", () => {
    const p = player({ accumulatedPoints: 10, crossState: "lost_by_flying", hasEverFlown: true });
    expect(canUseCross(p, 5).valid).toBe(false);
  });
});
