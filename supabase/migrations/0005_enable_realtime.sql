-- Habilita Supabase Realtime (postgres_changes) sobre las tablas que los
-- clientes necesitan sincronizar en vivo (docs/02-arquitectura.md §5).
--
-- game_secrets queda deliberadamente fuera: no tiene política de SELECT
-- para `authenticated`, así que agregarla a la publicación no serviría
-- de nada (Realtime respeta RLS igual que un SELECT normal).
--
-- REPLICA IDENTITY FULL es necesario para que los eventos UPDATE/DELETE
-- incluyan los valores anteriores de la fila, que Realtime necesita para
-- evaluar las políticas RLS correctamente en cada cambio.

alter table games replica identity full;
alter table players replica identity full;
alter table player_hands replica identity full;
alter table table_groups replica identity full;
alter table table_group_cards replica identity full;
alter table game_events replica identity full;
alter table scoreboard_rounds replica identity full;

alter publication supabase_realtime add table
  games,
  players,
  player_hands,
  table_groups,
  table_group_cards,
  game_events,
  scoreboard_rounds;
