import { describe, expect, it } from "vitest";
import { calculateCardPoints, calculateHandPoints } from "./points.js";
import { card, joker } from "./testUtils.js";

describe("calculateCardPoints", () => {
  it("A = 11", () => expect(calculateCardPoints(card("A", "hearts"))).toBe(11));
  it("7 = 7", () => expect(calculateCardPoints(card("7", "hearts"))).toBe(7));
  it("J = 10", () => expect(calculateCardPoints(card("J", "hearts"))).toBe(10));
  it("K = 10", () => expect(calculateCardPoints(card("K", "hearts"))).toBe(10));
  it("Comodín = 15", () => expect(calculateCardPoints(joker())).toBe(15));
});

describe("calculateHandPoints", () => {
  it("suma todas las cartas", () => {
    const points = calculateHandPoints([card("A", "hearts"), card("5", "clubs"), joker()]);
    expect(points).toBe(11 + 5 + 15);
  });

  it("mano vacía = 0", () => {
    expect(calculateHandPoints([])).toBe(0);
  });
});
