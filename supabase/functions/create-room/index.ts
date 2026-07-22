import { authenticate, HttpError } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin O/0/I/1 ambiguos
const INVITE_CODE_LENGTH = 6;
const MAX_INVITE_CODE_ATTEMPTS = 5;

function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INVITE_CODE_LENGTH));
  return Array.from(bytes, (b) => INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return errorResponse(new HttpError(405, "METHOD_NOT_ALLOWED", "Solo se acepta POST."));
  }

  try {
    const { user, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => ({}));

    const {
      name,
      maxPlayers = 8,
      isPrivate = false,
      currencyCode = "PEN",
      currencySymbol = "S/",
      initialEntryAmount = 1,
      reentryWithSinAmount = 1,
      reentryWithoutSinAmount = 0.5,
      sinBonusAmountPerOpponent = 1,
      reconnectTimeoutSeconds = 60,
    } = body ?? {};

    if (!name || typeof name !== "string") {
      throw new HttpError(400, "INVALID_BODY", "Falta el nombre de la sala.");
    }
    if (typeof maxPlayers !== "number" || maxPlayers < 3 || maxPlayers > 8) {
      throw new HttpError(400, "INVALID_BODY", "maxPlayers debe estar entre 3 y 8 (§3).");
    }

    let inviteCode = "";
    let room: { id: string } | null = null;
    for (let attempt = 0; attempt < MAX_INVITE_CODE_ATTEMPTS && !room; attempt += 1) {
      inviteCode = generateInviteCode();
      const { data, error } = await adminClient
        .from("rooms")
        .insert({
          name,
          host_user_id: user.id,
          max_players: maxPlayers,
          is_private: isPrivate,
          invite_code: inviteCode,
          currency_code: currencyCode,
          currency_symbol: currencySymbol,
          initial_entry_amount: initialEntryAmount,
          reentry_with_sin_amount: reentryWithSinAmount,
          reentry_without_sin_amount: reentryWithoutSinAmount,
          sin_bonus_amount_per_opponent: sinBonusAmountPerOpponent,
          reconnect_timeout_seconds: reconnectTimeoutSeconds,
        })
        .select("id")
        .single();
      if (!error) {
        room = data;
      } else if (!error.message?.includes("invite_code")) {
        throw new HttpError(500, "ROOM_CREATE_FAILED", error.message);
      }
      // si el error es por colisión de invite_code, reintenta con otro código
    }
    if (!room) {
      throw new HttpError(500, "INVITE_CODE_EXHAUSTED", "No se pudo generar un código de sala único.");
    }

    const { data: game, error: gameError } = await adminClient
      .from("games")
      .insert({ room_id: room.id, phase: "lobby", version: 0 })
      .select("id")
      .single();
    if (gameError) throw new HttpError(500, "GAME_CREATE_FAILED", gameError.message);

    const { error: secretsError } = await adminClient
      .from("game_secrets")
      .insert({ game_id: game.id, draw_pile: [], discard_pile: [] });
    if (secretsError) throw new HttpError(500, "SECRETS_CREATE_FAILED", secretsError.message);

    return jsonResponse({ ok: true, roomId: room.id, gameId: game.id, inviteCode }, 201);
  } catch (err) {
    return errorResponse(err);
  }
});
