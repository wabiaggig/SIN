import type { Card, Rank, Suit } from "./types.js";

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];
const RANKS: Exclude<Rank, "JOKER">[] = [
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

const JOKERS_PER_DECK = 2;

export function createTwoDecks(): Card[] {
  const cards: Card[] = [];
  for (const deckIndex of [1, 2] as const) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({
          id: `${deckIndex}-${suit}-${rank}`,
          rank,
          suit,
          deckIndex,
        });
      }
    }
    for (let jokerNumber = 1; jokerNumber <= JOKERS_PER_DECK; jokerNumber += 1) {
      cards.push({
        id: `${deckIndex}-joker-${jokerNumber}`,
        rank: "JOKER",
        suit: null,
        deckIndex,
      });
    }
  }
  return cards;
}

/** Mulberry32 PRNG — deterministic when a seed is provided. */
function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher-Yates shuffle. Deterministic only when a seed is passed;
 * server-side production shuffles must omit the seed so the order
 * cannot be predicted from the client-visible "cut" animation.
 */
export function shuffleDeck(cards: Card[], seed?: number): Card[] {
  const random = seed === undefined ? Math.random : mulberry32(seed);
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const cardAtI = shuffled[i]!;
    const cardAtJ = shuffled[j]!;
    shuffled[i] = cardAtJ;
    shuffled[j] = cardAtI;
  }
  return shuffled;
}
