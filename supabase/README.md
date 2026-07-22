# SIN — Supabase

Este directorio contiene el esquema de base de datos (Fase 5, ver `docs/02-arquitectura.md`).

**Estado:** desplegado en el proyecto `SIN-Game` (`dobxodpcmjdnvddxfwxu`, región us-west-2). Migraciones `0001`-`0004` aplicadas. La Edge Function `game-command` está desplegada y probada end-to-end (JWT real → motor → persistencia).

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

- Función de reparto/barajado inicial que arme la primera ronda (`startNewRound()` del motor ya existe; falta la Edge Function/RPC que la invoque y cree las filas iniciales de `games`/`players`/`player_hands`/`game_secrets`).
- Canales de Supabase Realtime por partida (`game:{gameId}:public` y `game:{gameId}:player:{playerId}`), según `docs/02-arquitectura.md` §5.
- Endpoint de creación de sala / unión por código de invitación.
