export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K"
  | "JOKER";

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";

export type Card = {
  id: string;
  rank: Rank;
  suit: Suit | null;
  deckIndex: 1 | 2;
};

export type BettingConfig = {
  currencyCode: string;
  currencySymbol: string;
  initialEntryAmount: number;
  reentryWithSinAmount: number;
  reentryWithoutSinAmount: number;
  sinBonusAmountPerOpponent: number;
};

export type PlayerRoundState = {
  hasCompletedFirstTurn: boolean;
};

export type PlayerStatus =
  | "waiting"
  | "active"
  | "resolving_after_knock"
  | "flown_pending_reentry"
  | "reentering"
  | "eliminated"
  | "codillo_eliminated"
  | "winner";

export type CrossState = "available" | "used" | "lost_by_flying";

export type PlayerGameState = {
  playerId: string;
  displayName: string;
  avatarUrl?: string;
  seatIndex: number;
  status: PlayerStatus;
  accumulatedPoints: number;
  currentRoundPoints: number | null;
  hand: Card[];
  crossState: CrossState;
  hasEverFlown: boolean;
  reentryCount: number;
  totalPaid: number;
  totalWon: number;
  hasCompletedFirstTurn: boolean;
};

export type GamePhase =
  | "lobby"
  | "waiting_for_entries"
  | "shuffling"
  | "cutting"
  | "dealing"
  | "playing"
  | "resolving_knock"
  | "checking_codillo"
  | "checking_flown_players"
  | "waiting_for_reentry_decisions"
  | "starting_next_round"
  | "finished";

export type TableGroupType = "same_rank" | "straight";

export type TableCard = {
  card: Card;
  ownerPlayerId: string;
  jokerRepresentsRank?: Rank;
};

export type TableGroup = {
  id: string;
  type: TableGroupType;
  cards: TableCard[];
  createdByPlayerId: string;
  locked: boolean;
};

export type WinType = "normal" | "sin" | "royal" | "royal_with_sin";

export type GameState = {
  gameId: string;
  roomCode: string;
  phase: GamePhase;
  players: PlayerGameState[];
  activePlayerId: string | null;
  dealerPlayerId: string;
  knockerPlayerId: string | null;
  drawPile: Card[];
  discardPile: Card[];
  tableGroups: TableGroup[];
  roundNumber: number;
  potAmount: number;
  bettingConfig: BettingConfig;
  winnerPlayerId: string | null;
  winType: WinType | null;
};

export type RoundState = {
  activePlayerId: string;
  firstRoundCompleted: boolean;
  hasDrawnThisTurn: boolean;
  hasTakenDiscardThisTurn: boolean;
};

export type RoundResult = {
  playerId: string;
  roundPoints: number;
};

export type GameSettlement = {
  winnerPlayerId: string;
  winType: WinType;
  potAmount: number;
  sinBonusPerOpponent: number;
  opponentPayments: { playerId: string; amount: number }[];
  sinBonusTotal: number;
  totalPrize: number;
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export type GameRuleError = {
  code: string;
  message: string;
  details?: Record<string, unknown>;
};

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: GameRuleError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<T>(code: string, message: string, details?: Record<string, unknown>): Result<T> {
  return { ok: false, error: { code, message, ...(details !== undefined ? { details } : {}) } };
}
