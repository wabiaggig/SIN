import type { Card, ValidationResult } from "./types.js";
import { validateStraightGroup } from "./groups.js";

const ROYAL_HAND_SIZE = 7;

/**
 * Royal: exactamente 7 cartas en mano formando una única escalera del
 * mismo palo. Puede contener uno o más comodines, sin límite artificial
 * (§43-44, decisión de producto en docs/01-analisis-funcional.md §7.8).
 * El llamador es responsable de pasar solo cartas en mano (no bajadas,
 * no enchufadas, no de la mesa) — el motor no tiene visibilidad de eso aquí.
 */
export function validateRoyal(cards: Card[]): ValidationResult {
  if (cards.length !== ROYAL_HAND_SIZE) {
    return {
      valid: false,
      reason: `Un royal requiere exactamente ${ROYAL_HAND_SIZE} cartas en mano.`,
    };
  }
  return validateStraightGroup(cards);
}
