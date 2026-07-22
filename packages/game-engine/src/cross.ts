import type { PlayerGameState, ValidationResult } from "./types.js";

const MAX_ACCUMULATED_POINTS = 69;

/**
 * Cruzarse (§30-31): el jugador no debe ser el golpeador, debe conservar
 * su cruz, el puntaje real de la ronda debe ser mayor que cero, y el total
 * real no debe superar 69. El golpeador nunca puede cruzarse — `isKnocker`
 * debe indicarse explícitamente por el llamador.
 */
export function canUseCross(
  player: PlayerGameState,
  roundPoints: number,
  isKnocker = false,
): ValidationResult {
  if (isKnocker) {
    return { valid: false, reason: "Quien golpea nunca puede usar su cruz en esa ronda." };
  }
  if (player.crossState !== "available") {
    return { valid: false, reason: "El jugador ya no tiene una cruz disponible." };
  }
  if (roundPoints <= 0) {
    return { valid: false, reason: "No tiene sentido usar la cruz con puntaje de ronda cero." };
  }
  if (player.accumulatedPoints + roundPoints > MAX_ACCUMULATED_POINTS) {
    return { valid: false, reason: "El jugador ya voló; no puede cruzarse." };
  }
  return { valid: true };
}
