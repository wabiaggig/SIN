import { describe, expect, it } from "vitest";
import { processCommand } from "./commands.js";
import { card } from "./testUtils.js";
import type { BettingConfig, GameState, PlayerGameState } from "./types.js";

const config: BettingConfig = {
  currencyCode: "PEN",
  currencySymbol: "S/",
  initialEntryAmount: 1,
  reentryWithSinAmount: 1,
  reentryWithoutSinAmount: 0.5,
  sinBonusAmountPerOpponent: 1,
};

function makePlayer(overrides: Partial<PlayerGameState> & { playerId: string }): PlayerGameState {
  return {
    displayName: overrides.playerId,
    seatIndex: 0,
    status: "active",
    accumulatedPoints: 0,
    currentRoundPoints: null,
    hand: [],
    crossState: "available",
    hasEverFlown: false,
    reentryCount: 0,
    totalPaid: 0,
    totalWon: 0,
    hasCompletedFirstTurn: false,
    ...overrides,
  };
}

function makeState(overrides: Partial<GameState> & { players: PlayerGameState[] }): GameState {
  return {
    gameId: "g1",
    roomCode: "ABCD",
    phase: "playing",
    activePlayerId: overrides.players[0]?.playerId ?? null,
    dealerPlayerId: overrides.players[0]?.playerId ?? "",
    knockerPlayerId: null,
    drawPile: [],
    discardPile: [],
    tableGroups: [],
    roundNumber: 1,
    potAmount: 0,
    bettingConfig: config,
    winnerPlayerId: null,
    winType: null,
    currentTurnHasDrawn: false,
    currentTurnHasTakenDiscard: false,
    resolutionOrder: [],
    resolutionIndex: 0,
    roundResults: [],
    awaitingDealerOpeningDiscard: false,
    ...overrides,
  };
}

describe("normal turn: draw then discard", () => {
  it("advances the turn to the next player and marks first-turn completion", () => {
    const drawn = card("9", "hearts");
    const state = makeState({
      players: [
        makePlayer({ playerId: "p1" }),
        makePlayer({ playerId: "p2" }),
        makePlayer({ playerId: "p3" }),
      ],
      drawPile: [drawn],
    });

    const afterDraw = processCommand(state, { type: "DRAW_CARD", playerId: "p1" });
    expect(afterDraw.ok).toBe(true);
    if (!afterDraw.ok) return;
    expect(afterDraw.value.state.currentTurnHasDrawn).toBe(true);
    expect(afterDraw.value.state.drawPile).toHaveLength(0);

    const afterDiscard = processCommand(afterDraw.value.state, {
      type: "DISCARD_CARD",
      playerId: "p1",
      cardId: drawn.id,
    });
    expect(afterDiscard.ok).toBe(true);
    if (!afterDiscard.ok) return;
    expect(afterDiscard.value.state.activePlayerId).toBe("p2");
    expect(afterDiscard.value.state.currentTurnHasDrawn).toBe(false);
    const p1 = afterDiscard.value.state.players.find((p) => p.playerId === "p1")!;
    expect(p1.hasCompletedFirstTurn).toBe(true);
    expect(p1.hand).toHaveLength(0);
  });

  it("rechaza robar si no es el turno del jugador", () => {
    const state = makeState({
      players: [makePlayer({ playerId: "p1" }), makePlayer({ playerId: "p2" })],
      drawPile: [card("2", "hearts")],
    });
    const result = processCommand(state, { type: "DRAW_CARD", playerId: "p2" });
    expect(result.ok).toBe(false);
  });
});

describe("descarte inicial del repartidor (§8, §10)", () => {
  it("el repartidor puede descartar sin haber robado ni tomado el descarte", () => {
    const dealtCard = card("K", "spades");
    const p1 = makePlayer({ playerId: "p1", hand: [dealtCard] });
    const p2 = makePlayer({ playerId: "p2" });
    const state = makeState({
      players: [p1, p2],
      activePlayerId: "p1",
      dealerPlayerId: "p1",
      awaitingDealerOpeningDiscard: true,
    });

    const result = processCommand(state, { type: "DISCARD_CARD", playerId: "p1", cardId: dealtCard.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.activePlayerId).toBe("p2");
    expect(result.value.state.awaitingDealerOpeningDiscard).toBe(false);
  });

  it("el descarte inicial del repartidor no cuenta como turno completo (no habilita su golpe)", () => {
    const dealtCard = card("K", "spades");
    const p1 = makePlayer({ playerId: "p1", hand: [dealtCard] });
    const p2 = makePlayer({ playerId: "p2" });
    const state = makeState({
      players: [p1, p2],
      activePlayerId: "p1",
      dealerPlayerId: "p1",
      awaitingDealerOpeningDiscard: true,
    });

    const result = processCommand(state, { type: "DISCARD_CARD", playerId: "p1", cardId: dealtCard.id });
    if (!result.ok) throw new Error("expected ok");
    const finalP1 = result.value.state.players.find((p) => p.playerId === "p1")!;
    expect(finalP1.hasCompletedFirstTurn).toBe(false);
  });

  it("un jugador que no es el repartidor sigue necesitando robar o tomar el descarte", () => {
    const dealtCard = card("K", "spades");
    const p1 = makePlayer({ playerId: "p1" });
    const p2 = makePlayer({ playerId: "p2", hand: [dealtCard] });
    const state = makeState({
      players: [p1, p2],
      activePlayerId: "p2",
      dealerPlayerId: "p1",
      awaitingDealerOpeningDiscard: true,
    });

    const result = processCommand(state, { type: "DISCARD_CARD", playerId: "p2", cardId: dealtCard.id });
    expect(result.ok).toBe(false);
  });
});

describe("knock → resolution: codillo", () => {
  it("golpeador con más puntos que todos, nadie vuela → codillo (§40-42)", () => {
    const p1 = makePlayer({
      playerId: "p1",
      hand: [card("5", "hearts"), card("K", "clubs")], // 15 pts
      hasCompletedFirstTurn: true,
    });
    const p2 = makePlayer({
      playerId: "p2",
      hand: [card("10", "hearts")], // 10 pts
      hasCompletedFirstTurn: true,
    });
    const p3 = makePlayer({
      playerId: "p3",
      hand: [card("3", "hearts")], // 3 pts
      hasCompletedFirstTurn: true,
    });
    const state = makeState({ players: [p1, p2, p3], activePlayerId: "p1" });

    const knocked = processCommand(state, { type: "KNOCK", playerId: "p1" });
    expect(knocked.ok).toBe(true);
    if (!knocked.ok) return;
    expect(knocked.value.state.phase).toBe("resolving_knock");
    expect(knocked.value.state.resolutionOrder).toEqual(["p2", "p3", "p1"]);
    expect(knocked.value.state.activePlayerId).toBe("p2");

    let current = knocked.value.state;
    for (const playerId of ["p2", "p3", "p1"]) {
      const step = processCommand(current, { type: "CONFIRM_RESOLUTION", playerId });
      expect(step.ok).toBe(true);
      if (!step.ok) return;
      current = step.value.state;
    }

    expect(current.phase).toBe("waiting_for_reentry_decisions");
    const finalP1 = current.players.find((p) => p.playerId === "p1")!;
    const finalP2 = current.players.find((p) => p.playerId === "p2")!;
    const finalP3 = current.players.find((p) => p.playerId === "p3")!;
    expect(finalP1.status).toBe("codillo_eliminated");
    expect(finalP1.accumulatedPoints).toBe(0);
    expect(finalP2.accumulatedPoints).toBe(10);
    expect(finalP3.accumulatedPoints).toBe(3);
    expect(current.dealerPlayerId).toBe("p2");
  });
});

describe("knock → resolution: vuelo termina la partida con SIN", () => {
  it("único jugador sin volar gana con SIN cuando nunca usó cruz ni voló", () => {
    const p1 = makePlayer({
      playerId: "p1",
      accumulatedPoints: 60,
      hand: [card("5", "hearts")], // 5 pts, total 65
      hasCompletedFirstTurn: true,
    });
    const p2 = makePlayer({
      playerId: "p2",
      accumulatedPoints: 65,
      hand: [card("10", "hearts")], // 10 pts, total 75 → vuela
      hasCompletedFirstTurn: true,
    });
    const state = makeState({ players: [p1, p2], activePlayerId: "p1" });

    const knocked = processCommand(state, { type: "KNOCK", playerId: "p1" });
    expect(knocked.ok).toBe(true);
    if (!knocked.ok) return;
    expect(knocked.value.state.resolutionOrder).toEqual(["p2", "p1"]);

    const step1 = processCommand(knocked.value.state, { type: "CONFIRM_RESOLUTION", playerId: "p2" });
    expect(step1.ok).toBe(true);
    if (!step1.ok) return;

    const step2 = processCommand(step1.value.state, { type: "CONFIRM_RESOLUTION", playerId: "p1" });
    expect(step2.ok).toBe(true);
    if (!step2.ok) return;

    expect(step2.value.state.phase).toBe("finished");
    expect(step2.value.state.winnerPlayerId).toBe("p1");
    expect(step2.value.state.winType).toBe("sin");
    const finalP2 = step2.value.state.players.find((p) => p.playerId === "p2")!;
    expect(finalP2.status).toBe("eliminated");
    expect(step2.value.events.some((e) => e.type === "GAME_FINISHED")).toBe(true);
  });
});

describe("USE_CROSS durante la resolución", () => {
  it("registra la ronda como cero y no permite usarla dos veces", () => {
    const p1 = makePlayer({ playerId: "p1", hand: [], hasCompletedFirstTurn: true });
    const p2 = makePlayer({
      playerId: "p2",
      accumulatedPoints: 60,
      hand: [card("9", "hearts")], // 9 pts, total 69, cruzable
      hasCompletedFirstTurn: true,
    });
    const state = makeState({ players: [p1, p2], activePlayerId: "p1" });

    const knocked = processCommand(state, { type: "KNOCK", playerId: "p1" });
    if (!knocked.ok) throw new Error("expected ok");
    expect(knocked.value.state.activePlayerId).toBe("p2");

    const crossed = processCommand(knocked.value.state, { type: "USE_CROSS", playerId: "p2" });
    expect(crossed.ok).toBe(true);
    if (!crossed.ok) return;
    expect(crossed.value.state.activePlayerId).toBe("p1");

    const finalStep = processCommand(crossed.value.state, { type: "CONFIRM_RESOLUTION", playerId: "p1" });
    if (!finalStep.ok) throw new Error("expected ok");

    const finalP2 = finalStep.value.state.players.find((p) => p.playerId === "p2")!;
    expect(finalP2.crossState).toBe("used");
    expect(finalP2.accumulatedPoints).toBe(60); // se anotó 0
  });

  it("el golpeador nunca puede usar la cruz", () => {
    const p1 = makePlayer({ playerId: "p1", hand: [card("2", "hearts")], hasCompletedFirstTurn: true });
    const p2 = makePlayer({ playerId: "p2", hand: [card("3", "hearts")], hasCompletedFirstTurn: true });
    const state = makeState({ players: [p1, p2], activePlayerId: "p1" });

    const knocked = processCommand(state, { type: "KNOCK", playerId: "p1" });
    if (!knocked.ok) throw new Error("expected ok");
    const step = processCommand(knocked.value.state, { type: "CONFIRM_RESOLUTION", playerId: "p2" });
    if (!step.ok) throw new Error("expected ok");

    const attempt = processCommand(step.value.state, { type: "USE_CROSS", playerId: "p1" });
    expect(attempt.ok).toBe(false);
  });
});

describe("REENTER", () => {
  it("reingresa con el puntaje máximo de los no volados y cobra el precio con SIN presente", () => {
    const p1 = makePlayer({ playerId: "p1", accumulatedPoints: 20, status: "active", crossState: "available" });
    const p2 = makePlayer({ playerId: "p2", accumulatedPoints: 47, status: "active", crossState: "used" });
    const p3 = makePlayer({
      playerId: "p3",
      status: "flown_pending_reentry",
      hasEverFlown: true,
      crossState: "lost_by_flying",
    });
    const state = makeState({
      players: [p1, p2, p3],
      phase: "waiting_for_reentry_decisions",
      activePlayerId: null,
      potAmount: 3,
    });

    const result = processCommand(state, { type: "REENTER", playerId: "p3" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const finalP3 = result.value.state.players.find((p) => p.playerId === "p3")!;
    expect(finalP3.status).toBe("active");
    expect(finalP3.accumulatedPoints).toBe(47);
    expect(finalP3.reentryCount).toBe(1);
    expect(result.value.state.potAmount).toBe(4); // SIN existe (p1) → reentryWithSinAmount = 1
  });

  it("rechaza reingresar si el jugador no está en flown_pending_reentry", () => {
    const p1 = makePlayer({ playerId: "p1", status: "active" });
    const state = makeState({ players: [p1], phase: "waiting_for_reentry_decisions" });
    const result = processCommand(state, { type: "REENTER", playerId: "p1" });
    expect(result.ok).toBe(false);
  });
});

describe("DECLARE_ROYAL", () => {
  it("termina la partida inmediatamente con una mano válida", () => {
    const cards = ["A", "2", "3", "4", "5", "6", "7"].map((rank) => card(rank as never, "hearts"));
    const p1 = makePlayer({ playerId: "p1", hand: cards, crossState: "available", hasEverFlown: false });
    const p2 = makePlayer({ playerId: "p2" });
    const state = makeState({ players: [p1, p2] });

    const result = processCommand(state, { type: "DECLARE_ROYAL", playerId: "p1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state.phase).toBe("finished");
    expect(result.value.state.winnerPlayerId).toBe("p1");
    expect(result.value.state.winType).toBe("royal_with_sin");
  });

  it("rechaza una mano inválida sin penalización (el estado no cambia)", () => {
    const p1 = makePlayer({ playerId: "p1", hand: [card("2", "hearts"), card("3", "clubs")] });
    const state = makeState({ players: [p1] });

    const result = processCommand(state, { type: "DECLARE_ROYAL", playerId: "p1" });
    expect(result.ok).toBe(false);
  });
});

describe("SING_SCOREBOARD", () => {
  it("no cambia el turno ni el estado", () => {
    const p1 = makePlayer({ playerId: "p1" });
    const state = makeState({ players: [p1] });
    const result = processCommand(state, { type: "SING_SCOREBOARD", playerId: "p1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.state).toBe(state);
    expect(result.value.events).toEqual([{ type: "SCOREBOARD_SUNG", playerId: "p1" }]);
  });
});
