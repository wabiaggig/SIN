import type { PlayerGameState, RoundState, ValidationResult } from "./types.js";

const MAX_ACCUMULATED_POINTS = 69;

/**
 * Un jugador puede golpear cuando es su turno, terminó la primera vuelta,
 * no robó ni tomó el descarte en este turno, y su total real no supera
 * 69 (§26-27).
 */
export function canKnock(
  player: PlayerGameState,
  handPoints: number,
  roundState: RoundState,
): ValidationResult {
  const isPlayerTurn = roundState.activePlayerId === player.playerId;

  if (!isPlayerTurn) {
    return { valid: false, reason: "No es el turno de este jugador." };
  }
  if (!roundState.firstRoundCompleted) {
    return { valid: false, reason: "No se puede golpear antes de completar la primera vuelta." };
  }
  if (roundState.hasDrawnThisTurn) {
    return { valid: false, reason: "No se puede golpear después de robar del mazo." };
  }
  if (roundState.hasTakenDiscardThisTurn) {
    return { valid: false, reason: "No se puede golpear después de tomar el descarte." };
  }
  if (player.accumulatedPoints + handPoints > MAX_ACCUMULATED_POINTS) {
    return { valid: false, reason: "El golpe haría volar al jugador (supera 69 puntos)." };
  }
  return { valid: true };
}
