import { describe, expect, it } from "vitest";
import { determineWinner } from "./winner.js";
import { player } from "./testUtils.js";

describe("determineWinner", () => {
  it("solo queda un jugador sin volar → gana", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "eliminated" }),
      player({ playerId: "p3", status: "eliminated" }),
    ];
    expect(determineWinner(players)).toBe("p1");
  });

  it("quedan dos o más activos → sin ganador todavía", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "active" }),
    ];
    expect(determineWinner(players)).toBeNull();
  });

  it("expulsados por codillo también cuentan como fuera de juego", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "codillo_eliminated" }),
    ];
    expect(determineWinner(players)).toBe("p1");
  });
});
