import type { PlayerGameState } from "./types.js";

const INACTIVE_STATUSES = new Set(["eliminated", "codillo_eliminated"]);

/**
 * La partida termina cuando queda un único jugador que no ha sido
 * eliminado (por vuelo sin reingreso o por codillo) (§38). Devuelve su
 * playerId, o null si todavía hay dos o más jugadores en juego.
 */
export function determineWinner(players: PlayerGameState[]): string | null {
  const remaining = players.filter((player) => !INACTIVE_STATUSES.has(player.status));
  if (remaining.length === 1) {
    return remaining[0]!.playerId;
  }
  return null;
}
