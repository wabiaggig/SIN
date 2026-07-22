import { describe, expect, it } from "vitest";
import { detectFlownPlayers } from "./flying.js";
import { player } from "./testUtils.js";

describe("detectFlownPlayers", () => {
  it("acumulado 62 + ronda 10 → vuela", () => {
    const p1 = player({ playerId: "p1", accumulatedPoints: 62 });
    const flown = detectFlownPlayers([p1], [{ playerId: "p1", roundPoints: 10 }]);
    expect(flown).toEqual(["p1"]);
  });

  it("acumulado 62 + ronda 7 → no vuela (total 69, exacto)", () => {
    const p1 = player({ playerId: "p1", accumulatedPoints: 62 });
    const flown = detectFlownPlayers([p1], [{ playerId: "p1", roundPoints: 7 }]);
    expect(flown).toEqual([]);
  });
});
