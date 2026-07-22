import type { RoundResult } from "./types.js";

/**
 * Hay codillo cuando el golpeador termina con estrictamente más puntos
 * que todos los demás y nadie voló en esa ronda (§40). Por decisión de
 * producto (docs/01-analisis-funcional.md §7.5), el codillo se evalúa
 * antes que los vuelos: si esta función se invoca con la lista de
 * volados ya calculada, un empate o un vuelo simultáneo lo invalida.
 */
export function detectCodillo(
  knockerId: string,
  results: RoundResult[],
  flownPlayerIds: string[],
): boolean {
  if (flownPlayerIds.length > 0) {
    return false;
  }
  const knockerResult = results.find((result) => result.playerId === knockerId);
  if (!knockerResult) {
    throw new Error("No se encontró el resultado del golpeador en esta ronda.");
  }
  const otherResults = results.filter((result) => result.playerId !== knockerId);
  return otherResults.every((other) => knockerResult.roundPoints > other.roundPoints);
}
