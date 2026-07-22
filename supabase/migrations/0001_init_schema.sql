-- SIN — esquema inicial (Fase 5, docs/02-arquitectura.md §3, §5, §7)
--
-- Principio rector: el servidor es la única fuente de verdad (PROMPT.md §54).
-- Todas las tablas de estado de partida tienen RLS con SOLO políticas de
-- SELECT para el rol `authenticated`. No hay políticas de INSERT/UPDATE/DELETE
-- para clientes: toda escritura ocurre exclusivamente desde Edge Functions
-- usando la service role key (que evade RLS por diseño de Supabase). Esto es
-- intencional, no un olvido — el cliente "solo solicita acciones" (§54).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- rooms
-- ---------------------------------------------------------------------------
create table rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  host_user_id uuid not null references auth.users (id),
  max_players int not null check (max_players between 3 and 8),
  is_private boolean not null default false,
  invite_code text not null unique,
  currency_code text not null,
  currency_symbol text not null,
  initial_entry_amount numeric not null check (initial_entry_amount >= 0),
  reentry_with_sin_amount numeric not null check (reentry_with_sin_amount >= 0),
  reentry_without_sin_amount numeric not null check (reentry_without_sin_amount >= 0),
  sin_bonus_amount_per_opponent numeric not null check (sin_bonus_amount_per_opponent >= 0),
  turn_time_limit_seconds int, -- reservado, sin efecto en el MVP (docs/01 §7.2)
  reconnect_timeout_seconds int not null default 60, -- configurable por el anfitrión (docs/01 §7.9)
  created_at timestamptz not null default now()
);

comment on column rooms.turn_time_limit_seconds is
  'Reservado para una versión futura. En el MVP los turnos no expiran automáticamente.';

-- ---------------------------------------------------------------------------
-- games — una partida dentro de una sala (una sala puede tener varias
-- partidas sucesivas, p.ej. tras un codillo)
-- ---------------------------------------------------------------------------
create table games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  phase text not null default 'lobby' check (
    phase in (
      'lobby', 'waiting_for_entries', 'shuffling', 'cutting', 'dealing',
      'playing', 'resolving_knock', 'checking_codillo', 'checking_flown_players',
      'waiting_for_reentry_decisions', 'starting_next_round', 'finished'
    )
  ),
  round_number int not null default 0,
  active_player_id uuid, -- fk a players.id, nullable, sin FK directa por orden de creación
  dealer_player_id uuid,
  knocker_player_id uuid,
  pot_amount numeric not null default 0,
  winner_player_id uuid,
  win_type text check (win_type in ('normal', 'sin', 'royal', 'royal_with_sin')),
  -- Campos de control de turno/resolución — ver game-engine/src/types.ts GameState,
  -- no están en el modelo "sugerido" de PROMPT.md pero son necesarios para que
  -- processCommand() sea determinista.
  current_turn_has_drawn boolean not null default false,
  current_turn_has_taken_discard boolean not null default false,
  resolution_order uuid[] not null default '{}',
  resolution_index int not null default 0,
  -- Reflejo público de game_secrets (mazo/descarte completos, ver más abajo):
  -- el cliente nunca lee game_secrets directamente, solo estos derivados.
  draw_pile_count int not null default 0,
  discard_top_card jsonb,
  -- Concurrencia optimista (docs/02-arquitectura.md §8): el cliente debe
  -- incluir la versión que cree vigente en cada comando.
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index games_room_id_idx on games (room_id);

-- ---------------------------------------------------------------------------
-- players — estado público de cada jugador dentro de una partida
-- ---------------------------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  user_id uuid not null references auth.users (id),
  display_name text not null,
  avatar_url text,
  seat_index int not null,
  status text not null default 'waiting' check (
    status in (
      'waiting', 'active', 'resolving_after_knock', 'flown_pending_reentry',
      'reentering', 'eliminated', 'codillo_eliminated', 'winner'
    )
  ),
  accumulated_points int not null default 0,
  current_round_points int,
  cross_state text not null default 'available' check (
    cross_state in ('available', 'used', 'lost_by_flying')
  ),
  has_ever_flown boolean not null default false,
  reentry_count int not null default 0,
  total_paid numeric not null default 0,
  total_won numeric not null default 0,
  has_completed_first_turn boolean not null default false,
  -- Derivado y público: cuántas cartas tiene en mano, sin revelar cuáles
  -- (PROMPT.md §55: "Los demás jugadores solo deben ver: cantidad de cartas").
  hand_count int not null default 0,
  unique (game_id, user_id),
  unique (game_id, seat_index)
);

create index players_game_id_idx on players (game_id);

alter table games
  add constraint games_active_player_fk foreign key (active_player_id) references players (id),
  add constraint games_dealer_player_fk foreign key (dealer_player_id) references players (id),
  add constraint games_knocker_player_fk foreign key (knocker_player_id) references players (id),
  add constraint games_winner_player_fk foreign key (winner_player_id) references players (id);

-- ---------------------------------------------------------------------------
-- player_hands — mano privada; SOLO el dueño puede leerla (§55)
-- ---------------------------------------------------------------------------
create table player_hands (
  player_id uuid primary key references players (id) on delete cascade,
  cards jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- game_secrets — mazo y descarte completos; nadie los lee directamente
-- desde el cliente, solo Edge Functions (service role). El descarte
-- "visible" (carta superior) y el conteo del mazo se exponen aparte,
-- en games.discard_top_card / games.draw_pile_count.
-- ---------------------------------------------------------------------------
create table game_secrets (
  game_id uuid primary key references games (id) on delete cascade,
  draw_pile jsonb not null default '[]',
  discard_pile jsonb not null default '[]'
);

-- ---------------------------------------------------------------------------
-- table_groups / table_group_cards — grupos bajados sobre la mesa (públicos)
-- ---------------------------------------------------------------------------
create table table_groups (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games (id) on delete cascade,
  type text not null check (type in ('same_rank', 'straight')),
  created_by_player_id uuid not null references players (id),
  locked boolean not null default false
);

create index table_groups_game_id_idx on table_groups (game_id);

create table table_group_cards (
  id uuid primary key default gen_random_uuid(),
  table_group_id uuid not null references table_groups (id) on delete cascade,
  -- Orden secuencial dentro del grupo — el motor asume que table_group_cards
  -- se mantiene ordenado (ver game-engine/src/joker.ts, comentario sobre
  -- que el motor no reordena grupos, PROMPT.md §22).
  position int not null,
  card jsonb not null,
  owner_player_id uuid not null references players (id),
  joker_represents_rank text,
  unique (table_group_id, position)
);

-- ---------------------------------------------------------------------------
-- game_events — historial append-only para auditoría y reconexión (§53, §56)
-- ---------------------------------------------------------------------------
create table game_events (
  id bigint generated always as identity primary key,
  game_id uuid not null references games (id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index game_events_game_id_idx on game_events (game_id, id);

-- ---------------------------------------------------------------------------
-- scoreboard_rounds — tabla de puntuaciones histórica (§47)
-- ---------------------------------------------------------------------------
create table scoreboard_rounds (
  game_id uuid not null references games (id) on delete cascade,
  round_number int not null,
  player_id uuid not null references players (id),
  -- Valor libre: número de puntos, 'X' (cruz), 'V' (voló), 'R47' (reingresó
  -- con 47), '—' (eliminado), 'C' (codillo), '0' (cero real).
  result_code text not null,
  primary key (game_id, round_number, player_id)
);

-- ---------------------------------------------------------------------------
-- Función auxiliar SECURITY DEFINER para unirse por código de invitación sin
-- exponer todas las salas privadas vía SELECT directo (docs/02-arquitectura.md §7).
-- ---------------------------------------------------------------------------
create or replace function get_room_by_invite_code(p_invite_code text)
returns table (
  id uuid,
  name text,
  max_players int,
  is_private boolean,
  currency_code text,
  currency_symbol text
)
language sql
security definer
set search_path = public
as $$
  select r.id, r.name, r.max_players, r.is_private, r.currency_code, r.currency_symbol
  from rooms r
  where r.invite_code = p_invite_code;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table rooms enable row level security;
alter table games enable row level security;
alter table players enable row level security;
alter table player_hands enable row level security;
alter table game_secrets enable row level security;
alter table table_groups enable row level security;
alter table table_group_cards enable row level security;
alter table game_events enable row level security;
alter table scoreboard_rounds enable row level security;

-- rooms: visible para el anfitrión o para quien ya tiene un asiento en
-- alguna partida de esa sala. El descubrimiento por código de invitación
-- pasa por get_room_by_invite_code(), no por SELECT directo.
create policy rooms_select_member on rooms
  for select to authenticated
  using (
    host_user_id = auth.uid()
    or exists (
      select 1 from players p
      join games g on g.id = p.game_id
      where g.room_id = rooms.id and p.user_id = auth.uid()
    )
  );

-- games: visible solo para jugadores de esa partida.
create policy games_select_member on games
  for select to authenticated
  using (
    exists (
      select 1 from players p
      where p.game_id = games.id and p.user_id = auth.uid()
    )
  );

-- players: visible para cualquier jugador de la misma partida (estado
-- público: nombre, asiento, puntaje, hand_count — nunca las cartas).
create policy players_select_same_game on players
  for select to authenticated
  using (
    exists (
      select 1 from players self
      where self.game_id = players.game_id and self.user_id = auth.uid()
    )
  );

-- player_hands: SOLO el dueño de la mano.
create policy player_hands_select_owner on player_hands
  for select to authenticated
  using (
    exists (
      select 1 from players p
      where p.id = player_hands.player_id and p.user_id = auth.uid()
    )
  );

-- game_secrets: nadie desde el cliente (ni siquiera el dueño de la partida).
-- Sin políticas de SELECT para `authenticated` ⇒ acceso denegado por defecto.

-- table_groups / table_group_cards: visibles para jugadores de la partida
-- (son públicos por definición — están "sobre la mesa").
create policy table_groups_select_same_game on table_groups
  for select to authenticated
  using (
    exists (
      select 1 from players p
      where p.game_id = table_groups.game_id and p.user_id = auth.uid()
    )
  );

create policy table_group_cards_select_same_game on table_group_cards
  for select to authenticated
  using (
    exists (
      select 1 from table_groups tg
      join players p on p.game_id = tg.game_id
      where tg.id = table_group_cards.table_group_id and p.user_id = auth.uid()
    )
  );

create policy game_events_select_same_game on game_events
  for select to authenticated
  using (
    exists (
      select 1 from players p
      where p.game_id = game_events.game_id and p.user_id = auth.uid()
    )
  );

create policy scoreboard_rounds_select_same_game on scoreboard_rounds
  for select to authenticated
  using (
    exists (
      select 1 from players p
      where p.game_id = scoreboard_rounds.game_id and p.user_id = auth.uid()
    )
  );
