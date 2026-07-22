import { describe, expect, it } from "vitest";
import { validateRoyal } from "./royal.js";
import { card, joker } from "./testUtils.js";

describe("validateRoyal", () => {
  it("7 cartas del mismo palo en escalera → royal", () => {
    const cards = ["A", "2", "3", "4", "5", "6", "7"].map((rank) => card(rank as never, "hearts"));
    expect(validateRoyal(cards).valid).toBe(true);
  });

  it("7 cartas con comodines válidos → royal", () => {
    const cards = [card("2", "clubs"), card("3", "clubs"), joker(), card("5", "clubs"), card("6", "clubs"), card("7", "clubs"), card("8", "clubs")];
    expect(validateRoyal(cards).valid).toBe(true);
  });

  it("8 cartas → no royal", () => {
    const cards = ["A", "2", "3", "4", "5", "6", "7", "8"].map((rank) => card(rank as never, "hearts"));
    expect(validateRoyal(cards).valid).toBe(false);
  });

  it("6 cartas → no royal", () => {
    const cards = ["A", "2", "3", "4", "5", "6"].map((rank) => card(rank as never, "hearts"));
    expect(validateRoyal(cards).valid).toBe(false);
  });

  it("7 cartas de diferentes palos → no royal", () => {
    const cards = [
      card("A", "hearts"),
      card("2", "hearts"),
      card("3", "clubs"),
      card("4", "hearts"),
      card("5", "hearts"),
      card("6", "hearts"),
      card("7", "hearts"),
    ];
    expect(validateRoyal(cards).valid).toBe(false);
  });

  it("múltiples comodines sin límite artificial", () => {
    const cards = [card("4", "spades"), joker(), joker(2), card("7", "spades"), card("8", "spades"), card("9", "spades"), card("10", "spades")];
    expect(validateRoyal(cards).valid).toBe(true);
  });
});
