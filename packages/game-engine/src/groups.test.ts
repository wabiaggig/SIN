import { describe, expect, it } from "vitest";
import { validateGroup, validateSameRankGroup, validateStraightGroup } from "./groups.js";
import { card, joker } from "./testUtils.js";

describe("validateSameRankGroup", () => {
  it("[2♥, 2♣, 2♠] → válido", () => {
    const result = validateSameRankGroup([card("2", "hearts"), card("2", "clubs"), card("2", "spades")]);
    expect(result.valid).toBe(true);
  });

  it("[2♥, 2♥, 2♠] → válido (dos barajas)", () => {
    const result = validateSameRankGroup([
      card("2", "hearts", 1),
      card("2", "hearts", 2),
      card("2", "spades"),
    ]);
    expect(result.valid).toBe(true);
  });

  it("[2♥, 2♣] → inválido (menos de 3)", () => {
    const result = validateSameRankGroup([card("2", "hearts"), card("2", "clubs")]);
    expect(result.valid).toBe(false);
  });

  it("[2♥, 2♣, joker] → inválido", () => {
    const result = validateSameRankGroup([card("2", "hearts"), card("2", "clubs"), joker()]);
    expect(result.valid).toBe(false);
  });

  it("7,7,7,7,7 → válido, sin máximo especial", () => {
    const result = validateSameRankGroup([
      card("7", "hearts", 1),
      card("7", "clubs", 1),
      card("7", "spades", 1),
      card("7", "diamonds", 1),
      card("7", "hearts", 2),
    ]);
    expect(result.valid).toBe(true);
  });
});

describe("validateStraightGroup", () => {
  it("[A♥, 2♥, 3♥] → válida", () => {
    expect(validateStraightGroup([card("A", "hearts"), card("2", "hearts"), card("3", "hearts")]).valid).toBe(true);
  });

  it("[Q♥, K♥, A♥] → válida", () => {
    expect(validateStraightGroup([card("Q", "hearts"), card("K", "hearts"), card("A", "hearts")]).valid).toBe(true);
  });

  it("[K♥, A♥, 2♥] → válida", () => {
    expect(validateStraightGroup([card("K", "hearts"), card("A", "hearts"), card("2", "hearts")]).valid).toBe(true);
  });

  it("[10♥, J♥, Q♥, K♥, A♥, 2♥, 3♥] → válida", () => {
    const cards = ["10", "J", "Q", "K", "A", "2", "3"].map((rank) => card(rank as never, "hearts"));
    expect(validateStraightGroup(cards).valid).toBe(true);
  });

  it("[4♥, 4♥, 5♥] → inválida (valor repetido)", () => {
    expect(validateStraightGroup([card("4", "hearts"), card("4", "hearts", 2), card("5", "hearts")]).valid).toBe(
      false,
    );
  });

  it("[4♥, 5♣, 6♥] → inválida (palos distintos)", () => {
    expect(validateStraightGroup([card("4", "hearts"), card("5", "clubs"), card("6", "hearts")]).valid).toBe(false);
  });

  it("no puede dar más de una vuelta completa", () => {
    const cards = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"].map((rank) =>
      card(rank as never, "hearts"),
    );
    // 13 cartas = una vuelta completa exacta, válida
    expect(validateStraightGroup(cards).valid).toBe(true);
  });

  it("comodines", () => {
    expect(validateStraightGroup([card("2", "hearts"), joker(), card("4", "hearts")]).valid).toBe(true);
  });

  it("[2♥, joker, 4♣] → inválida (palos naturales distintos)", () => {
    expect(validateStraightGroup([card("2", "hearts"), joker(), card("4", "clubs")]).valid).toBe(false);
  });

  it("[8♥, 8♣, joker] → inválida como escalera (mismo valor no es secuencia)", () => {
    expect(validateStraightGroup([card("8", "hearts"), card("8", "clubs"), joker()]).valid).toBe(false);
  });

  it("Q, K, A, 2, 3, 4, 5 → válida (circular extendida)", () => {
    const cards = ["Q", "K", "A", "2", "3", "4", "5"].map((rank) => card(rank as never, "spades"));
    expect(validateStraightGroup(cards).valid).toBe(true);
  });
});

describe("validateGroup", () => {
  it("[8♥, 8♣, joker] → inválido en ambos modos", () => {
    expect(validateGroup([card("8", "hearts"), card("8", "clubs"), joker()]).valid).toBe(false);
  });

  it("acepta grupo de mismo valor", () => {
    expect(validateGroup([card("K", "hearts"), card("K", "clubs"), card("K", "spades")]).valid).toBe(true);
  });

  it("acepta escalera", () => {
    expect(validateGroup([card("3", "clubs"), card("4", "clubs"), card("5", "clubs")]).valid).toBe(true);
  });
});
