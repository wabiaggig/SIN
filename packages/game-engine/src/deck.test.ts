import { describe, expect, it } from "vitest";
import { createTwoDecks, shuffleDeck } from "./deck.js";

describe("createTwoDecks", () => {
  it("crea 108 cartas (2 x 52 + 2 x 2 comodines)", () => {
    expect(createTwoDecks()).toHaveLength(108);
  });

  it("todas las cartas tienen id único", () => {
    const ids = createTwoDecks().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("shuffleDeck", () => {
  it("misma semilla produce el mismo orden", () => {
    const deck = createTwoDecks();
    const a = shuffleDeck(deck, 42);
    const b = shuffleDeck(deck, 42);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });

  it("no pierde ni duplica cartas al barajar", () => {
    const deck = createTwoDecks();
    const shuffled = shuffleDeck(deck, 1);
    expect(shuffled.map((c) => c.id).sort()).toEqual(deck.map((c) => c.id).sort());
  });
});
