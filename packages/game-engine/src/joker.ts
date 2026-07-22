import type { TableGroup } from "./types.js";

/**
 * Un comodín visible solo puede moverse mientras está en un extremo de una
 * escalera (§19). Asume que `group.cards` se mantiene en orden secuencial
 * por quien construye/extiende el grupo (bajar/enchufar) — el motor no
 * reordena grupos (§22).
 */
export function isJokerMovable(group: TableGroup, cardId: string): boolean {
  if (group.type !== "straight") {
    return false;
  }
  const index = group.cards.findIndex((tableCard) => tableCard.card.id === cardId);
  if (index === -1) {
    return false;
  }
  if (group.cards[index]!.card.rank !== "JOKER") {
    return false;
  }
  return index === 0 || index === group.cards.length - 1;
}
