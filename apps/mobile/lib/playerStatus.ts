import type { PlayerRow } from "./types";

export const STATUS_LABEL: Record<string, string> = {
  waiting: "Esperando",
  active: "Activo",
  resolving_after_knock: "Resolviendo",
  flown_pending_reentry: "Voló",
  reentering: "Reingresando",
  eliminated: "Eliminado",
  codillo_eliminated: "Codillo",
  winner: "Ganador",
};

export const STATUS_COLOR: Record<string, string> = {
  waiting: "#f2c94c",
  active: "#6fcf97",
  resolving_after_knock: "#6fcf97",
  flown_pending_reentry: "#e07a3f",
  reentering: "#e0a13f",
  eliminated: "#8f8f8f",
  codillo_eliminated: "#ff6b6b",
  winner: "#f5c542",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function statusColor(status: string): string {
  return STATUS_COLOR[status] ?? "#cfe3d8";
}

/** Un jugador conserva SIN mientras nunca usó la cruz ni voló (PROMPT.md §2). */
export function hasSin(player: PlayerRow): boolean {
  return player.cross_state === "available" && !player.has_ever_flown;
}
