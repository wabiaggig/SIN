import { describe, expect, it } from "vitest";
import { detectCodillo } from "./codillo.js";

describe("detectCodillo", () => {
  it("golpeador 15, otros 10, 12 y 3, nadie vuela → codillo", () => {
    const results = [
      { playerId: "knocker", roundPoints: 15 },
      { playerId: "p2", roundPoints: 10 },
      { playerId: "p3", roundPoints: 3 },
      { playerId: "p4", roundPoints: 12 },
    ];
    expect(detectCodillo("knocker", results, [])).toBe(true);
  });

  it("golpeador 15, otro 15 → no codillo (empate)", () => {
    const results = [
      { playerId: "knocker", roundPoints: 15 },
      { playerId: "p2", roundPoints: 15 },
    ];
    expect(detectCodillo("knocker", results, [])).toBe(false);
  });

  it("golpeador 15, otro 16 → no codillo", () => {
    const results = [
      { playerId: "knocker", roundPoints: 15 },
      { playerId: "p2", roundPoints: 16 },
    ];
    expect(detectCodillo("knocker", results, [])).toBe(false);
  });

  it("golpeador 15, todos menores, alguien vuela → no codillo", () => {
    const results = [
      { playerId: "knocker", roundPoints: 15 },
      { playerId: "p2", roundPoints: 10 },
    ];
    expect(detectCodillo("knocker", results, ["p2"])).toBe(false);
  });
});
