# SIN — Supabase

Este directorio contiene el esquema de base de datos (Fase 5, ver `docs/02-arquitectura.md`).

**Estado:** desplegado en el proyecto `SIN-Game` (`dobxodpcmjdnvddxfwxu`, región us-west-2). Migraciones `0001`-`0004` aplicadas. Las 5 Edge Functions (`create-room`, `join-room`, `confirm-entry`, `start-game`, `game-command`) están desplegadas y probadas end-to-end con un pipeline completo: crear sala → 3 jugadores se unen → confirman entrada → el host inicia la partida (reparto real) → un jugador juega un turno.

Auth: login por magic link (email), habilitado por defecto — no se configuró OAuth de Google.

## Aplicar una nueva migración

El proyecto ya está vinculado (`supabase link` ya se corrió). Para aplicar una migración nueva, agregá el archivo SQL a `migrations/` con el siguiente número de secuencia y corré:

```bash
npx supabase db push
```

`supabase db push` aplica todos los archivos pendientes en `migrations/` en orden.

## Modelo de seguridad (RLS)

Todas las tablas de estado de partida tienen Row Level Security activada, y **ninguna tiene políticas de INSERT/UPDATE/DELETE para el rol `authenticated`**. Esto es intencional, no un olvido: el servidor es la única fuente de verdad (PROMPT.md §54). Los clientes solo pueden `SELECT`; toda escritura ocurre desde Edge Functions usando la `service_role` key, que evade RLS por diseño de Supabase.

Puntos clave:

- **`player_hands`**: solo el dueño puede leer su propia mano (`user_id = auth.uid()`). Nadie más, ni siquiera otros jugadores de la misma partida.
- **`game_secrets`** (mazo y descarte completos): sin política de `SELECT` para `authenticated` → nadie desde el cliente puede leerlo, ni el propio dueño. Lo que el cliente ve del mazo/descarte son los campos derivados y públicos en `games.draw_pile_count` y `games.discard_top_card`, que las Edge Functions mantienen sincronizados.
- **`rooms`**: visibles solo para el anfitrión o para quien ya tiene un asiento en una partida de esa sala. El descubrimiento de una sala por código de invitación pasa por la función `get_room_by_invite_code()` (SECURITY DEFINER), que expone solo los campos públicos necesarios para decidir si unirse — no por `SELECT` directo sobre `rooms`.

## Edge Functions

Todas comparten `_shared/auth.ts` (verifica el JWT del llamador y devuelve un cliente `service_role`) y `_shared/response.ts`.

### `create-room`

`POST { name, maxPlayers, isPrivate?, currencyCode?, currencySymbol?, initialEntryAmount?, reentryWithSinAmount?, reentryWithoutSinAmount?, sinBonusAmountPerOpponent?, reconnectTimeoutSeconds? }` → `{ ok, roomId, gameId, inviteCode }`. El llamador queda como `host_user_id`; crea también la primera fila de `games` (`phase='lobby'`) y su `game_secrets` vacío. El anfitrión no obtiene un asiento automáticamente — también debe llamar a `join-room`.

### `join-room`

`POST { inviteCode, displayName, avatarUrl? }` → `{ ok, roomId, gameId, playerId, seatIndex }`. Busca la sala vía `get_room_by_invite_code` (nunca `SELECT` directo sobre `rooms`), encuentra su partida en `lobby`/`waiting_for_entries`, asigna el siguiente asiento. Rechaza si ya está lleno o si el usuario ya tiene asiento ahí.

### `confirm-entry`

`POST { gameId }` → `{ ok, playerId, paid }`. Pasa al jugador de `waiting` a `active`, descuenta la entrada inicial de la sala, la suma al pozo, y crea su fila vacía en `player_hands`.

### `start-game`

`POST { gameId }` → `{ ok, version, dealerPlayerId }`. Solo el anfitrión. Requiere ≥3 jugadores `active` (§3). Elige repartidor al azar (`crypto.getRandomValues`, una de las opciones documentadas en §7), baraja dos barajas sin semilla, y arma la ronda inicial con `startNewRound()` del motor — persistida reutilizando la misma RPC `apply_game_command` que usa `game-command` (un reparto inicial es, en el fondo, otro resultado de estado más).

### `game-command` (desplegada)

Recibe `{ gameId, command }`, autentica al llamador por su JWT, resuelve su `playerId` desde `players.user_id = auth.uid()` (nunca confía en el `playerId` que venga en el body), carga el `GameState` completo, lo pasa por `processCommand()` del motor, y persiste el resultado vía la RPC `apply_game_command` con concurrencia optimista sobre `games.version`.

Antes de cada deploy hay que reconstruir el motor, porque la función importa el JS compilado, no el TypeScript fuente:

```bash
cd packages/game-engine && npm run build
cd ../.. && npx supabase functions deploy game-command
```

Invocación desde el cliente:

```
POST https://dobxodpcmjdnvddxfwxu.supabase.co/functions/v1/game-command
Authorization: Bearer <jwt del usuario logueado>
Content-Type: application/json

{ "gameId": "...", "command": { "type": "DRAW_CARD", "playerId": "..." } }
```

Respuestas: `200 { ok: true, version, events }` · `400` error de regla de juego (`{ error: { code, message } }`) · `403` el usuario no es jugador de esa partida · `409` conflicto de versión (reintentar) · `401` sin autenticar.

## Pendiente (siguiente iteración de Fase 5)

- Canales de Supabase Realtime por partida (`game:{gameId}:public` y `game:{gameId}:player:{playerId}`), según `docs/02-arquitectura.md` §5. Como las tablas ya tienen RLS, los `postgres_changes` deberían filtrarse automáticamente por jugador sin plumbing adicional — falta verificarlo en la práctica.
- Reconexión: el `reconnect_timeout_seconds` de la sala está guardado pero nada lo usa todavía (requiere lógica de sesión/presencia).
- Codillo → siguiente partida: cuando el motor marca a alguien `codillo_eliminated`, el reglamento dice que debe pagar las entradas de la próxima partida (§41) — eso todavía no está implementado en `confirm-entry`/`create-room`.
- Nada de esto se probó todavía desde una app real — todo el pipeline se validó con llamadas HTTP directas (ver historial de commits para los scripts de smoke test).
