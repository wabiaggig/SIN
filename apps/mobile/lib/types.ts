export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10"
  | "J" | "Q" | "K" | "JOKER";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit | null;
  deckIndex: 1 | 2;
};

export type TableCard = {
  card: Card;
  ownerPlayerId: string;
  jokerRepresentsRank?: Rank;
};

export type TableGroup = {
  id: string;
  type: "same_rank" | "straight";
  createdByPlayerId: string;
  locked: boolean;
  cards: TableCard[];
};

export type PlayerRow = {
  id: string;
  user_id: string;
  display_name: string;
  seat_index: number;
  status: string;
  accumulated_points: number;
  cross_state: "available" | "used" | "lost_by_flying";
  has_ever_flown: boolean;
  hand_count: number;
};

export type GameRow = {
  id: string;
  room_id: string;
  phase: string;
  active_player_id: string | null;
  dealer_player_id: string | null;
  knocker_player_id: string | null;
  current_turn_has_drawn: boolean;
  current_turn_has_taken_discard: boolean;
  awaiting_dealer_opening_discard: boolean;
  draw_pile_count: number;
  discard_top_card: Card | null;
  pot_amount: number;
  round_number: number;
  resolution_order: string[];
  resolution_index: number;
};
