# SIN — Supabase

Este directorio contiene el esquema de base de datos (Fase 5, ver `docs/02-arquitectura.md`).

**Estado:** desplegado en el proyecto `SIN-Game` (`dobxodpcmjdnvddxfwxu`, región us-west-2). Migración `0001_init_schema.sql` aplicada.

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

## Pendiente (siguiente iteración de Fase 5)

- Edge Functions que reciban `GameCommand`, verifiquen autorización (¿pertenece el jugador a esta partida? ¿es su turno?), invoquen `@sin/game-engine` (`processCommand`), y persistan `{ state, events }` en una transacción.
- Canales de Supabase Realtime por partida (`game:{gameId}:public` y `game:{gameId}:player:{playerId}`), según `docs/02-arquitectura.md` §5.
- Función de reparto/barajado inicial (usa `createTwoDecks()` + `shuffleDeck()` del motor, sin semilla en producción).
