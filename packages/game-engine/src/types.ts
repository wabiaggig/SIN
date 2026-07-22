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
  /**
   * Campos de control de turno/ronda no listados literalmente en
   * PROMPT.md (que marca su modelo de estado como "sugerido") pero
   * necesarios para que processCommand aplique las reglas de forma
   * determinista: qué hizo el jugador activo en este turno, y en qué
   * punto de la resolución post-golpe estamos.
   */
  currentTurnHasDrawn: boolean;
  currentTurnHasTakenDiscard: boolean;
  resolutionOrder: string[];
  resolutionIndex: number;
  roundResults: RoundResult[];
  /**
   * El repartidor inicia la ronda descartando una carta, sin haber
   * robado ni tomado el descarte antes (§8), y ese descarte NO cuenta
   * como turno completo para habilitar el golpe (§10). Este flag deja
   * que handleDiscardCard distinga ese descarte inicial de un descarte
   * normal de fin de turno.
   */
  awaitingDealerOpeningDiscard: boolean;
};

export type GameEvent =
  | { type: "PLAYER_JOINED"; playerId: string }
  | { type: "PLAYER_CONFIRMED_ENTRY"; playerId: string }
  | { type: "DECK_SHUFFLED" }
  | { type: "DECK_CUT"; playerId: string }
  | { type: "CARDS_DEALT" }
  | { type: "CARD_DRAWN"; playerId: string }
  | { type: "DISCARD_TAKEN"; playerId: string }
  | { type: "GROUP_LAID_DOWN"; playerId: string; groupId: string }
  | { type: "CARD_ATTACHED"; playerId: string; groupId: string }
  | { type: "CARD_DISCARDED"; playerId: string }
  | { type: "DECK_RECYCLED" }
  | { type: "KNOCK_DECLARED"; playerId: string }
  | { type: "CROSS_USED"; playerId: string }
  | { type: "PLAYER_FLEW"; playerId: string }
  | { type: "PLAYER_REENTERED"; playerId: string; score: number }
  | { type: "PLAYER_ELIMINATED"; playerId: string }
  | { type: "CODILLO_DECLARED"; playerId: string }
  | { type: "ROYAL_DECLARED"; playerId: string }
  | { type: "SCOREBOARD_SUNG"; playerId: string }
  | { type: "GAME_FINISHED"; winnerPlayerId: string };

export type DrawCardCommand = { type: "DRAW_CARD"; playerId: string };
export type TakeDiscardCommand = {
  type: "TAKE_DISCARD";
  playerId: string;
  /** Cartas propias + la carta del descarte que forman el grupo inmediato (§13). */
  groupCardIds: string[];
};
export type LayDownGroupCommand = { type: "LAY_DOWN_GROUP"; playerId: string; cardIds: string[] };
export type AttachCardCommand = {
  type: "ATTACH_CARD";
  playerId: string;
  groupId: string;
  cardId: string;
};
export type DiscardCardCommand = { type: "DISCARD_CARD"; playerId: string; cardId: string };
export type KnockCommand = { type: "KNOCK"; playerId: string };
export type UseCrossCommand = { type: "USE_CROSS"; playerId: string };
/**
 * Cierra el paso de resolución del jugador activo durante resolving_knock
 * y avanza al siguiente. No es una acción de juego documentada en
 * PROMPT.md §66 — es una necesidad de la máquina de estados para saber
 * cuándo un jugador terminó de bajar/enchufar/decidir su cruz.
 */
export type ConfirmResolutionCommand = { type: "CONFIRM_RESOLUTION"; playerId: string };
export type ReenterCommand = { type: "REENTER"; playerId: string };
export type DeclareRoyalCommand = { type: "DECLARE_ROYAL"; playerId: string };
export type SingScoreboardCommand = { type: "SING_SCOREBOARD"; playerId: string };

export type GameCommand =
  | DrawCardCommand
  | TakeDiscardCommand
  | LayDownGroupCommand
  | AttachCardCommand
  | DiscardCardCommand
  | KnockCommand
  | UseCrossCommand
  | ConfirmResolutionCommand
  | ReenterCommand
  | DeclareRoyalCommand
  | SingScoreboardCommand;

export type CommandOutcome = {
  state: GameState;
  events: GameEvent[];
};

export type RoundState = {
  activePlayerId: string;
  firstRoundCompleted: boolean;
  hasDrawnThisTurn: boolean;
  hasTakenDiscardThisTurn: boolean;
};

export type RoundResult = {
  playerId: string;
  /** Puntos registrados para acumulación (0 si el jugador se cruzó). */
  roundPoints: number;
  /**
   * Puntos reales en mano, sin el efecto de la cruz. Si se omite, se
   * asume igual a `roundPoints` (caso sin cruz). Se usa para la
   * comparación de codillo — decisión de producto: la cruz no debe
   * poder generar ni evitar un codillo (docs/01-analisis-funcional.md).
   */
  realPoints?: number;
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
