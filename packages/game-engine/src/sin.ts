import type { PlayerGameState } from "./types.js";

/**
 * Un jugador conserva SIN mientras nunca haya usado su cruz ni haya
 * volado (§2, §50).
 */
export function hasSin(player: PlayerGameState): boolean {
  return player.crossState === "available" && !player.hasEverFlown;
}
