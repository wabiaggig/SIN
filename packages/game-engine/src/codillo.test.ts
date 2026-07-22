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

  it("la cruz no puede generar codillo: compara contra el puntaje real, no el registrado", () => {
    // p2 se cruzó: roundPoints=0 (registrado), pero su mano real tenía 8 puntos.
    const results = [
      { playerId: "knocker", roundPoints: 5, realPoints: 5 },
      { playerId: "p2", roundPoints: 0, realPoints: 8 },
    ];
    expect(detectCodillo("knocker", results, [])).toBe(false);
  });

  it("la cruz no puede evitar un codillo real", () => {
    // p2 se cruzó, pero su puntaje real (2) sigue siendo menor al del golpeador (5).
    const results = [
      { playerId: "knocker", roundPoints: 5, realPoints: 5 },
      { playerId: "p2", roundPoints: 0, realPoints: 2 },
    ];
    expect(detectCodillo("knocker", results, [])).toBe(true);
  });
});
