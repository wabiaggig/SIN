import type { PlayerGameState, RoundResult } from "./types.js";

const MAX_ACCUMULATED_POINTS = 69;

/**
 * Un jugador vuela cuando acumulado + puntaje de ronda supera 69 (§33).
 * Devuelve los playerId de todos los jugadores que volaron esta ronda.
 */
export function detectFlownPlayers(
  players: PlayerGameState[],
  roundResults: RoundResult[],
): string[] {
  const pointsByPlayer = new Map(roundResults.map((result) => [result.playerId, result.roundPoints]));
  return players
    .filter((player) => {
      const roundPoints = pointsByPlayer.get(player.playerId);
      if (roundPoints === undefined) {
        return false;
      }
      return player.accumulatedPoints + roundPoints > MAX_ACCUMULATED_POINTS;
    })
    .map((player) => player.playerId);
}
