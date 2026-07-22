import type { Card, Rank, ValidationResult } from "./types.js";

const MIN_GROUP_SIZE = 3;

/** Fixed circular order used for straights — A sits between K and 2. */
const CIRCULAR_RANK_ORDER: Exclude<Rank, "JOKER">[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

function rankIndex(rank: Exclude<Rank, "JOKER">): number {
  return CIRCULAR_RANK_ORDER.indexOf(rank);
}

function valid(): ValidationResult {
  return { valid: true };
}

function invalid(reason: string): ValidationResult {
  return { valid: false, reason };
}

/**
 * Grupo del mismo valor: 3+ cartas del mismo rango. No admite comodines (§15).
 * Duplicados exactos son válidos porque se usan dos barajas.
 */
export function validateSameRankGroup(cards: Card[]): ValidationResult {
  if (cards.length < MIN_GROUP_SIZE) {
    return invalid(`Se requieren al menos ${MIN_GROUP_SIZE} cartas.`);
  }
  if (cards.some((card) => card.rank === "JOKER")) {
    return invalid("El comodín no puede utilizarse en grupos del mismo valor.");
  }
  const firstRank = cards[0]!.rank;
  if (cards.some((card) => card.rank !== firstRank)) {
    return invalid("Todas las cartas deben tener el mismo valor.");
  }
  return valid();
}

/**
 * Escalera: 3+ cartas consecutivas del mismo palo, sin valores repetidos,
 * as circular (antes del 2, después de K, entre K y 2), sin dar más de una
 * vuelta completa (§16-18). Los comodines rellenan huecos.
 */
export function validateStraightGroup(cards: Card[]): ValidationResult {
  if (cards.length < MIN_GROUP_SIZE) {
    return invalid(`Se requieren al menos ${MIN_GROUP_SIZE} cartas.`);
  }
  if (cards.length > CIRCULAR_RANK_ORDER.length) {
    return invalid("Una escalera no puede dar más de una vuelta completa.");
  }

  const naturalCards = cards.filter((card) => card.rank !== "JOKER");
  const jokerCount = cards.length - naturalCards.length;

  if (naturalCards.length === 0) {
    return invalid("Una escalera necesita al menos una carta natural.");
  }

  const suits = new Set(naturalCards.map((card) => card.suit));
  if (suits.size > 1 || suits.has(null)) {
    return invalid("Todas las cartas naturales deben ser del mismo palo.");
  }

  const naturalIndices = naturalCards.map((card) => rankIndex(card.rank as Exclude<Rank, "JOKER">));
  if (new Set(naturalIndices).size !== naturalIndices.length) {
    return invalid("No se puede repetir un valor dentro de la escalera.");
  }

  const length = cards.length;
  const canFormArc = CIRCULAR_RANK_ORDER.some((_, start) => {
    const arc = new Set<number>();
    for (let offset = 0; offset < length; offset += 1) {
      arc.add((start + offset) % CIRCULAR_RANK_ORDER.length);
    }
    return naturalIndices.every((index) => arc.has(index));
  });

  if (!canFormArc) {
    return invalid("Las cartas no forman una escalera consecutiva válida.");
  }

  void jokerCount;
  return valid();
}

/** Intenta validar como grupo del mismo valor o como escalera (§14). */
export function validateGroup(cards: Card[]): ValidationResult {
  const sameRank = validateSameRankGroup(cards);
  if (sameRank.valid) {
    return sameRank;
  }
  const straight = validateStraightGroup(cards);
  if (straight.valid) {
    return straight;
  }
  return invalid("El grupo no es válido como set del mismo valor ni como escalera.");
}
