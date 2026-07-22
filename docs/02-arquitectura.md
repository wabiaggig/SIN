# SIN — Fase 2: Arquitectura

Basado en `PROMPT.md` §60-62 y §68, con decisión confirmada: **Supabase** como backend de MVP (Auth + PostgreSQL + Realtime + Edge Functions).

## 1. Estructura del monorepo

```
SIN-Project/
  apps/
    mobile/              # Expo + React Native + TypeScript
  packages/
    game-engine/          # Reglas puras, sin dependencias de React/RN/DB/WS
    shared-types/          # Tipos TS compartidos entre engine, backend y mobile
    validation/            # Esquemas Zod para comandos y payloads
    ui/                     # Componentes visuales reutilizables (cartas, mesa, botones)
  docs/
    01-analisis-funcional.md
    02-arquitectura.md
```

`game-engine` es el único paquete con la lógica de reglas. Ni `mobile` ni las Edge Functions duplican validaciones — todas las decisiones de negocio pasan por `game-engine`.

## 2. Separación de responsabilidades

| Capa | Responsabilidad | No debe hacer |
|---|---|---|
| `game-engine` | Validar comandos, calcular puntajes, mutar estado de forma pura (retorna nuevo estado + eventos), detectar codillo/vuelo/royal/ganador, calcular liquidación. | Tocar red, DB, React, temporizadores reales. |
| Backend (Supabase Edge Functions + Postgres) | Recibir comandos del cliente, verificar autorización (¿es su turno? ¿es su sala?), invocar `game-engine`, persistir el nuevo estado, publicar eventos vía Realtime. | Reimplementar reglas de juego. |
| `apps/mobile` | Renderizar estado recibido, capturar intenciones del usuario, enviarlas como comandos. | Decidir si una jugada es válida — solo puede mostrar feedback optimista y corregirse con la respuesta del servidor. |

## 3. Modelo de datos (Postgres, vía Supabase)

Tablas principales (nombres orientativos):

```
rooms
  id, name, host_player_id, max_players, is_private, invite_code,
  currency_code, currency_symbol, initial_entry_amount,
  reentry_with_sin_amount, reentry_without_sin_amount,
  sin_bonus_per_opponent, turn_time_limit_seconds, created_at

games
  id, room_id, phase, active_player_id, dealer_player_id,
  knocker_player_id, round_number, pot_amount, winner_player_id,
  win_type, created_at, updated_at

players
  id, game_id, user_id, display_name, avatar_url, seat_index,
  status, accumulated_points, current_round_points, cross_state,
  has_ever_flown, reentry_count, total_paid, total_won,
  has_completed_first_turn

player_hands            -- privado, RLS estricta por owner
  player_id, cards (jsonb Card[])

draw_pile / discard_pile
  game_id, cards (jsonb Card[], orden relevante)

table_groups
  id, game_id, type, created_by_player_id, locked

table_group_cards
  table_group_id, card (jsonb), owner_player_id, joker_represents_rank

game_events              -- event log append-only, fuente de auditoría/reconexión
  id, game_id, type, payload (jsonb), created_at

scoreboard_rounds        -- tabla de puntuaciones histórica
  game_id, round_number, player_id, result_code (points | 'X' | 'V' | 'R47' | '—' | 'C' | 0)
```

Los tipos TypeScript en `packages/shared-types` deben ser el espejo exacto de `Card`, `PlayerGameState`, `GameState`, `TableGroup`, `BettingConfig`, `GameEvent` ya definidos en `PROMPT.md` §4, §5, §50-53.

## 4. Contratos TypeScript

Se reutilizan literalmente los tipos y firmas de funciones definidos en `PROMPT.md`:

- Tipos de estado: `Card`, `BettingConfig`, `PlayerRoundState`, `PlayerStatus`, `CrossState`, `PlayerGameState`, `GamePhase`, `GameState`, `TableGroupType`, `TableCard`, `TableGroup` (§4, §5, §50-52).
- Eventos: `GameEvent` (§53).
- Comandos y resultado: `GameCommand`, `Result<T>`, `GameRuleError` (§66).
- Funciones puras del motor: `calculateCardPoints`, `calculateHandPoints`, `validateSameRankGroup`, `validateStraightGroup`, `validateGroup`, `validateRoyal`, `canTakeDiscard`, `canKnock`, `canUseCross`, `detectFlownPlayers`, `detectCodillo`, `calculateReentryScore`, `calculateReentryPrice`, `determineWinner`, `calculateGameSettlement` (§62).

`shared-types` exporta estos tipos; `game-engine` los importa y los usa como interfaz pública de sus comandos.

## 5. Eventos y sincronización (Supabase Realtime)

Flujo por comando de usuario:

```
Cliente → invoca Edge Function (o RPC) con GameCommand
  → Edge Function verifica sesión/autorización (¿el jugador pertenece a esta partida y es su turno?)
  → Edge Function llama a game-engine con el estado actual (leído de Postgres) + comando
  → game-engine devuelve Result<{ newState, events }>
      - si ok=false → responde error tipado al cliente, sin persistir nada
      - si ok=true → persiste newState (transacción) + inserta eventos en game_events
  → Supabase Realtime difunde el cambio (Postgres changes o broadcast) a todos los suscritos al game_id
  → Cada cliente actualiza su vista local con el nuevo estado público
```

Canales Realtime sugeridos por partida:
- `game:{gameId}:public` — cambios de `games`, `players` (campos públicos), `table_groups`, tamaños de mazo/descarte, `game_events`.
- `game:{gameId}:player:{playerId}` — canal privado solo para la mano del jugador (`player_hands`), protegido por RLS.

Row Level Security en `player_hands`: cada fila solo visible para `auth.uid() = players.user_id` vía join. El resto de jugadores nunca reciben el contenido de manos ajenas, solo su longitud (se puede exponer como columna derivada `hand_count` en `players`, no en `player_hands`).

## 6. Estrategia de reconexión

1. El cliente se autentica con Supabase Auth y guarda `playerId`/`gameId` localmente.
2. Al reconectar, hace un fetch inicial del estado completo permitido (estado público + su propia mano vía RLS) en vez de depender solo de eventos incrementales.
3. Se suscribe de nuevo a los canales Realtime.
4. El asiento permanece reservado mientras `players.status` no sea `eliminated`; el temporizador de espera (recomendado 60s, ver contradicción #9 en Fase 1) lo gestiona el backend, no el cliente.
5. Tras el límite de espera, el anfitrión recibe opciones (pausar / esperar / expulsar) — implementado como acción de host, no automática, salvo que se decida lo contrario.

## 7. Seguridad

- Autoridad del servidor: ninguna decisión de reglas ocurre en el cliente (§54). El cliente solo emite `GameCommand`.
- RLS en Postgres para: `player_hands` (dueño), `draw_pile`/`discard_pile` reales (el mazo completo nunca se expone; el cliente solo ve el tamaño y la carta superior del descarte), `rooms` privadas (solo miembros o vía código de invitación válido).
- Edge Functions validan pertenencia a la partida y turno antes de invocar `game-engine`.
- Validación de payloads de entrada con Zod (`packages/validation`) antes de tocar cualquier lógica.
- Barajado: debe ejecutarse server-side (Edge Function/Postgres function) con una fuente de aleatoriedad no predecible por el cliente; el "corte simbólico" del jugador es cosmético (ver contradicción #3 de Fase 1, pendiente de confirmar).

## 8. Control de concurrencia

- Cada partida tiene un `updated_at`/versión incremental en `games`. Los comandos deben incluir la versión de estado que el cliente cree tener vigente (optimistic concurrency); si no coincide, el backend rechaza y el cliente refresca.
- Solo el `active_player_id` puede emitir comandos de turno; comandos fuera de turno se rechazan con `GameRuleError`.
- Las transacciones de escritura (persistir `newState` + insertar eventos) deben ser atómicas (una transacción Postgres) para evitar estados inconsistentes ante fallos parciales.

## 9. Pendiente antes de Fase 4 (motor de juego)

Antes de escribir código del `game-engine`, conviene resolver las contradicciones señaladas en `01-analisis-funcional.md` §7, especialmente:
- comportamiento del "tiempo por turno",
- orden de evaluación codillo vs. vuelos en la misma ronda,
- alcance exacto de comodines dentro de un royal.
