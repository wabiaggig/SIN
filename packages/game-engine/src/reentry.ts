import type { BettingConfig, PlayerGameState } from "./types.js";
import { hasSin } from "./sin.js";

const INACTIVE_STATUSES = new Set(["eliminated", "codillo_eliminated"]);

/**
 * Quien reingresa vuelve con el puntaje acumulado más alto de todos los
 * jugadores que no volaron (§35).
 */
export function calculateReentryScore(nonFlownPlayers: PlayerGameState[]): number {
  if (nonFlownPlayers.length === 0) {
    throw new Error("No hay jugadores sin volar para calcular el puntaje de reingreso.");
  }
  return Math.max(...nonFlownPlayers.map((player) => player.accumulatedPoints));
}

/**
 * El precio de reingreso depende de si todavía existe SIN entre los
 * jugadores activos de la partida (§37). Los expulsados por codillo o
 * eliminados definitivamente no cuentan para esta comprobación.
 */
export function calculateReentryPrice(players: PlayerGameState[], config: BettingConfig): number {
  const activePlayers = players.filter((player) => !INACTIVE_STATUSES.has(player.status));
  const sinExists = activePlayers.some((player) => hasSin(player));
  return sinExists ? config.reentryWithSinAmount : config.reentryWithoutSinAmount;
}
