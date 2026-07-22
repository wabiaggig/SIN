import { createClient } from "npm:@supabase/supabase-js@2";
import { processCommand } from "../../../packages/game-engine/dist/index.js";
import { corsHeaders } from "../_shared/cors.ts";
import { loadGameState, serializeOutcome } from "./state.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: { code: "METHOD_NOT_ALLOWED", message: "Solo se acepta POST." } }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return jsonResponse({ error: { code: "UNAUTHENTICATED", message: "Falta el header Authorization." } }, 401);
  }

  let body: { gameId?: string; command?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: { code: "INVALID_JSON", message: "El cuerpo no es JSON válido." } }, 400);
  }

  const gameId = body.gameId;
  const command = body.command;
  if (!gameId || !command || typeof command.type !== "string") {
    return jsonResponse(
      { error: { code: "INVALID_BODY", message: "Se requiere { gameId, command: { type, ... } }." } },
      400,
    );
  }

  // Cliente con el JWT del llamador — solo para identificarlo, nunca para
  // leer/escribir datos de juego (eso siempre pasa por el cliente admin).
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData?.user) {
    return jsonResponse({ error: { code: "UNAUTHENTICATED", message: "Token inválido o expirado." } }, 401);
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // El playerId que importa es el que resolvemos desde el JWT, nunca el
  // que venga en el body — el cliente jamás decide en nombre de quién actúa
  // (PROMPT.md §54).
  const { data: playerRow, error: playerError } = await adminClient
    .from("players")
    .select("id")
    .eq("game_id", gameId)
    .eq("user_id", userData.user.id)
    .maybeSingle();

  if (playerError) {
    return jsonResponse({ error: { code: "INTERNAL_ERROR", message: playerError.message } }, 500);
  }
  if (!playerRow) {
    return jsonResponse(
      { error: { code: "NOT_A_PLAYER", message: "El usuario no es jugador de esta partida." } },
      403,
    );
  }

  let state, expectedVersion: string, roomId: string;
  try {
    const loaded = await loadGameState(adminClient, gameId);
    state = loaded.state;
    expectedVersion = loaded.version;
    roomId = loaded.roomId;
  } catch (loadError) {
    return jsonResponse(
      { error: { code: "STATE_LOAD_FAILED", message: (loadError as Error).message } },
      500,
    );
  }

  const resolvedCommand = { ...command, playerId: playerRow.id } as Parameters<typeof processCommand>[1];

  const result = processCommand(state, resolvedCommand);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, 400);
  }

  const rpcParams = serializeOutcome(result.value);
  const { data: newVersion, error: rpcError } = await adminClient.rpc("apply_game_command", {
    p_game_id: gameId,
    p_expected_version: expectedVersion,
    ...rpcParams,
  });

  if (rpcError) {
    if (rpcError.message?.includes("version_conflict")) {
      return jsonResponse(
        { error: { code: "VERSION_CONFLICT", message: "El estado cambió antes de aplicar este comando. Reintentá." } },
        409,
      );
    }
    return jsonResponse({ error: { code: "PERSIST_FAILED", message: rpcError.message } }, 500);
  }

  // Codillo (§41): quien golpeó y quedó expulsado debe pagar las entradas
  // de la siguiente partida de esta sala. Se registra en rooms para que
  // start-game lo liquide cuando arranque esa siguiente partida.
  const codilloEvent = result.value.events.find((e) => e.type === "CODILLO_DECLARED") as
    | { type: "CODILLO_DECLARED"; playerId: string }
    | undefined;
  if (codilloEvent) {
    const { data: knockerPlayer } = await adminClient
      .from("players")
      .select("user_id")
      .eq("id", codilloEvent.playerId)
      .maybeSingle();
    if (knockerPlayer) {
      await adminClient
        .from("rooms")
        .update({ codillo_debtor_user_id: knockerPlayer.user_id })
        .eq("id", roomId);
    }
  }

  return jsonResponse({ ok: true, version: newVersion, events: result.value.events }, 200);
});
