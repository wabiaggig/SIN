import { describe, expect, it } from "vitest";
import { isJokerMovable } from "./joker.js";
import { card, joker } from "./testUtils.js";
import type { TableGroup } from "./types.js";

function straightGroup(cards: ReturnType<typeof card>[]): TableGroup {
  return {
    id: "g1",
    type: "straight",
    createdByPlayerId: "p1",
    locked: false,
    cards: cards.map((c) => ({ card: c, ownerPlayerId: "p1" })),
  };
}

describe("isJokerMovable", () => {
  it("comodín en el extremo inicial es movible", () => {
    const j = joker();
    const group = straightGroup([j, card("2", "hearts"), card("3", "hearts")]);
    expect(isJokerMovable(group, j.id)).toBe(true);
  });

  it("comodín en el extremo final es movible", () => {
    const j = joker();
    const group = straightGroup([card("2", "hearts"), card("3", "hearts"), j]);
    expect(isJokerMovable(group, j.id)).toBe(true);
  });

  it("comodín encerrado entre cartas naturales no es movible", () => {
    const j = joker();
    const group = straightGroup([card("K", "hearts"), j, card("2", "hearts"), card("3", "hearts")]);
    expect(isJokerMovable(group, j.id)).toBe(false);
  });

  it("no aplica a grupos del mismo valor", () => {
    const j = joker();
    const group: TableGroup = {
      id: "g2",
      type: "same_rank",
      createdByPlayerId: "p1",
      locked: false,
      cards: [{ card: j, ownerPlayerId: "p1" }],
    };
    expect(isJokerMovable(group, j.id)).toBe(false);
  });
});
