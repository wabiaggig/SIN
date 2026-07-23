import type { Card, Rank } from "./types";

const POINTS: Record<Rank, number> = {
  A: 11, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10,
  J: 10, Q: 10, K: 10, JOKER: 15,
};

export function cardPoints(card: Card): number {
  return POINTS[card.rank];
}

export function handPoints(cards: Card[]): number {
  return cards.reduce((total, c) => total + cardPoints(c), 0);
}

const SUIT_SYMBOL: Record<NonNullable<Card["suit"]>, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};

export function suitSymbol(suit: Card["suit"]): string {
  return suit ? SUIT_SYMBOL[suit] : "★";
}

export function isRedSuit(suit: Card["suit"]): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function cardLabel(card: Card): string {
  if (card.rank === "JOKER") return "JOKER";
  return `${card.rank}${suitSymbol(card.suit)}`;
}
