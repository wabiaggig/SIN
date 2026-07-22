import type { PlayerGameState } from "./types.js";

/** Los turnos avanzan hacia la derecha en la mesa circular (§9). */
export function getNextActivePlayer(
  currentPlayerId: string,
  orderedPlayers: PlayerGameState[],
): PlayerGameState {
  const currentIndex = orderedPlayers.findIndex((player) => player.playerId === currentPlayerId);
  for (let offset = 1; offset <= orderedPlayers.length; offset += 1) {
    const index = (currentIndex + offset) % orderedPlayers.length;
    const candidate = orderedPlayers[index]!;
    if (candidate.status === "active") {
      return candidate;
    }
  }
  throw new Error("No hay otro jugador activo.");
}
