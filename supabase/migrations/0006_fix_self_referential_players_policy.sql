-- Bug encontrado al probar Realtime end-to-end: la política
-- `players_select_same_game` es auto-referencial (players.select consulta
-- players.select), y Supabase Realtime (WALRUS) no resuelve correctamente
-- las políticas RLS auto-referenciales al filtrar postgres_changes — el
-- evento simplemente no se entrega a nadie, sin error. Esto afecta en
-- cascada a TODAS las políticas que dependen de `players` (player_hands,
-- table_groups, table_group_cards, game_events, scoreboard_rounds),
-- porque sus subconsultas a `players` heredan la política rota.
--
-- Confirmado empíricamente con tablas de prueba aisladas:
-- - Política trivial (using true) → funciona.
-- - auth.uid() = columna → funciona.
-- - EXISTS subquery a OTRA tabla (no auto-referencial) → funciona.
-- - EXISTS subquery a LA MISMA tabla (auto-referencial) → NO funciona,
--   cero eventos entregados, sin error visible.
--
-- Fix: envolver la consulta en una función SECURITY DEFINER, que evade
-- RLS al ejecutarse como el dueño de la función — rompe la auto-referencia
-- desde la perspectiva del planificador de Realtime.

create or replace function is_member_of_game(p_game_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from players
    where players.game_id = p_game_id and players.user_id = auth.uid()
  );
$$;

revoke execute on function is_member_of_game(uuid) from public;
grant execute on function is_member_of_game(uuid) to authenticated, service_role;

drop policy if exists players_select_same_game on players;
create policy players_select_same_game on players
  for select to authenticated
  using (is_member_of_game(players.game_id));
