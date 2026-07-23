type EventPayload = { type: string; playerId?: string; groupId?: string; score?: number; winnerPlayerId?: string };

/**
 * Traduce un GameEvent crudo (PROMPT.md §53) a una línea de historial
 * legible. `nameOf` resuelve un playerId a su nombre visible.
 */
export function describeEvent(payload: EventPayload, nameOf: (playerId: string) => string): string {
  const who = payload.playerId ? nameOf(payload.playerId) : "";
  switch (payload.type) {
    case "PLAYER_JOINED":
      return `${who} se unió a la sala`;
    case "PLAYER_CONFIRMED_ENTRY":
      return `${who} confirmó su entrada`;
    case "DECK_SHUFFLED":
      return "Se barajó el mazo";
    case "DECK_CUT":
      return `${who} cortó el mazo`;
    case "CARDS_DEALT":
      return "Se repartieron las cartas";
    case "CARD_DRAWN":
      return `${who} robó del mazo`;
    case "DISCARD_TAKEN":
      return `${who} tomó el descarte`;
    case "GROUP_LAID_DOWN":
      return `${who} bajó un grupo`;
    case "CARD_ATTACHED":
      return `${who} enchufó una carta`;
    case "CARD_DISCARDED":
      return `${who} descartó una carta`;
    case "DECK_RECYCLED":
      return "El mazo se recicló desde el descarte";
    case "KNOCK_DECLARED":
      return `${who} golpeó`;
    case "CROSS_USED":
      return `${who} usó su cruz`;
    case "PLAYER_FLEW":
      return `${who} voló`;
    case "PLAYER_REENTERED":
      return `${who} reingresó${payload.score !== undefined ? ` con ${payload.score} puntos` : ""}`;
    case "PLAYER_ELIMINATED":
      return `${who} quedó eliminado`;
    case "CODILLO_DECLARED":
      return `¡Codillo! ${who} quedó expulsado`;
    case "ROYAL_DECLARED":
      return `¡Royal! ${who} lo declaró`;
    case "SCOREBOARD_SUNG":
      return `${who} cantó la tabla`;
    case "GAME_FINISHED":
      return `🏆 Partida terminada — ganó ${payload.winnerPlayerId ? nameOf(payload.winnerPlayerId) : "?"}`;
    default:
      return payload.type;
  }
}
