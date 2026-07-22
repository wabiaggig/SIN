import type { GameSettlement, GameState } from "./types.js";

/**
 * Calcula la liquidación final: el ganador se lleva el pozo, y si ganó
 * con SIN (o royal con SIN), cada rival le paga además el bono SIN
 * configurado (§39, §45). Requiere que la partida ya tenga un ganador
 * determinado (fase "finished"); es responsabilidad del llamador
 * garantizarlo.
 */
export function calculateGameSettlement(game: GameState): GameSettlement {
  if (!game.winnerPlayerId || !game.winType) {
    throw new Error("La partida todavía no tiene un ganador determinado.");
  }

  const isSinWin = game.winType === "sin" || game.winType === "royal_with_sin";
  const opponents = game.players.filter((player) => player.playerId !== game.winnerPlayerId);
  const sinBonusPerOpponent = game.bettingConfig.sinBonusAmountPerOpponent;

  const opponentPayments = isSinWin
    ? opponents.map((opponent) => ({ playerId: opponent.playerId, amount: sinBonusPerOpponent }))
    : [];

  const sinBonusTotal = opponentPayments.reduce((total, payment) => total + payment.amount, 0);

  return {
    winnerPlayerId: game.winnerPlayerId,
    winType: game.winType,
    potAmount: game.potAmount,
    sinBonusPerOpponent,
    opponentPayments,
    sinBonusTotal,
    totalPrize: game.potAmount + sinBonusTotal,
  };
}
