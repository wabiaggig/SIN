import { describe, expect, it } from "vitest";
import { createTwoDecks, shuffleDeck } from "./deck.js";
import { dealRound, startNewRound } from "./dealing.js";
import { player } from "./testUtils.js";
import type { BettingConfig } from "./types.js";

const config: BettingConfig = {
  currencyCode: "PEN",
  currencySymbol: "S/",
  initialEntryAmount: 1,
  reentryWithSinAmount: 1,
  reentryWithoutSinAmount: 0.5,
  sinBonusAmountPerOpponent: 1,
};

describe("dealRound", () => {
  it("reparte 7 cartas a cada jugador activo y 8 al repartidor", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "active" }),
      player({ playerId: "p3", status: "active" }),
    ];
    const deck = shuffleDeck(createTwoDecks(), 7);

    const { players: dealt, drawPile } = dealRound(players, "p1", deck);

    const dealer = dealt.find((p) => p.playerId === "p1")!;
    const others = dealt.filter((p) => p.playerId !== "p1");
    expect(dealer.hand).toHaveLength(8);
    for (const other of others) {
      expect(other.hand).toHaveLength(7);
    }
    expect(drawPile).toHaveLength(deck.length - 8 - 7 - 7);
  });

  it("no reparte cartas duplicadas ni pierde cartas", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "active" }),
    ];
    const deck = shuffleDeck(createTwoDecks(), 3);
    const { players: dealt, drawPile } = dealRound(players, "p1", deck);

    const dealtIds = dealt.flatMap((p) => p.hand.map((c) => c.id));
    const allIds = [...dealtIds, ...drawPile.map((c) => c.id)];
    expect(new Set(allIds).size).toBe(allIds.length);
    expect(allIds.sort()).toEqual(deck.map((c) => c.id).sort());
  });

  it("ignora jugadores no activos (eliminados/volados)", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "eliminated" }),
      player({ playerId: "p3", status: "active" }),
    ];
    const deck = shuffleDeck(createTwoDecks(), 9);
    const { players: dealt } = dealRound(players, "p1", deck);

    const p2 = dealt.find((p) => p.playerId === "p2")!;
    expect(p2.hand).toHaveLength(0);
  });

  it("resetea hasCompletedFirstTurn y currentRoundPoints para la nueva ronda", () => {
    const players = [
      player({ playerId: "p1", status: "active", hasCompletedFirstTurn: true, currentRoundPoints: 20 }),
      player({ playerId: "p2", status: "active", hasCompletedFirstTurn: true, currentRoundPoints: 5 }),
    ];
    const deck = shuffleDeck(createTwoDecks(), 11);
    const { players: dealt } = dealRound(players, "p1", deck);

    for (const p of dealt) {
      expect(p.hasCompletedFirstTurn).toBe(false);
      expect(p.currentRoundPoints).toBeNull();
    }
  });
});

describe("startNewRound", () => {
  it("construye un GameState listo para jugar con el repartidor esperando su descarte inicial", () => {
    const players = [
      player({ playerId: "p1", status: "active" }),
      player({ playerId: "p2", status: "active" }),
      player({ playerId: "p3", status: "active" }),
    ];
    const deck = shuffleDeck(createTwoDecks(), 5);

    const state = startNewRound({
      gameId: "g1",
      roomCode: "ABCD",
      players,
      dealerPlayerId: "p1",
      shuffledDrawPile: deck,
      roundNumber: 1,
      potAmount: 3,
      bettingConfig: config,
    });

    expect(state.phase).toBe("playing");
    expect(state.activePlayerId).toBe("p1");
    expect(state.awaitingDealerOpeningDiscard).toBe(true);
    expect(state.discardPile).toHaveLength(0);
    expect(state.players.find((p) => p.playerId === "p1")!.hand).toHaveLength(8);
  });
});
