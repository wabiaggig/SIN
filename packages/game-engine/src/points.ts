import type { Card, Rank } from "./types.js";

const CARD_POINTS: Record<Rank, number> = {
  A: 11,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
  "7": 7,
  "8": 8,
  "9": 9,
  "10": 10,
  J: 10,
  Q: 10,
  K: 10,
  JOKER: 15,
};

export function calculateCardPoints(card: Card): number {
  return CARD_POINTS[card.rank];
}

export function calculateHandPoints(cards: Card[]): number {
  return cards.reduce((total, card) => total + calculateCardPoints(card), 0);
}
