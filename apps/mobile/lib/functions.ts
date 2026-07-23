import { supabase } from "./supabase";

export type FnError = { code: string; message: string };

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    // supabase-js no parsea el body de errores HTTP automáticamente; lo
    // leemos nosotros del FunctionsHttpError si está disponible.
    const context = (error as { context?: Response }).context;
    if (context) {
      try {
        const parsed = await context.clone().json();
        if (parsed?.error) throw parsed.error as FnError;
      } catch {
        // sigue al throw genérico de abajo
      }
    }
    throw { code: "NETWORK_ERROR", message: error.message } satisfies FnError;
  }
  return data as T;
}

export type CreateRoomInput = {
  name: string;
  maxPlayers: number;
  isPrivate?: boolean;
  currencyCode?: string;
  currencySymbol?: string;
  initialEntryAmount?: number;
  reentryWithSinAmount?: number;
  reentryWithoutSinAmount?: number;
  sinBonusAmountPerOpponent?: number;
};

export function createRoom(input: CreateRoomInput) {
  return invoke<{ ok: true; roomId: string; gameId: string; inviteCode: string }>("create-room", input);
}

export function joinRoom(input: { inviteCode: string; displayName: string; avatarUrl?: string }) {
  return invoke<{ ok: true; roomId: string; gameId: string; playerId: string; seatIndex: number }>(
    "join-room",
    input,
  );
}

export function confirmEntry(input: { gameId: string }) {
  return invoke<{ ok: true; playerId: string; paid: number }>("confirm-entry", input);
}

export function startGame(input: { gameId: string }) {
  return invoke<{
    ok: true;
    version: number;
    dealerPlayerId: string;
    codilloSettlement: { debtorUserId: string; amount: number } | null;
  }>("start-game", input);
}

export function startNextRound(input: { gameId: string }) {
  return invoke<{ ok: true; version: number; dealerPlayerId: string }>("start-next-round", input);
}

export function createNextGame(input: { roomId: string }) {
  return invoke<{ ok: true; gameId: string }>("create-next-game", input);
}

export function gameCommand(input: { gameId: string; command: Record<string, unknown> }) {
  return invoke<{ ok: true; version: number; events: unknown[] }>("game-command", input);
}
