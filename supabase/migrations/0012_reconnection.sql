-- Soporte para desconexiones reales (PROMPT.md §56): cada jugador reporta
-- su propio last_seen_at con un heartbeat periódico desde el cliente, y el
-- anfitrión puede expulsar a quien lleve más de rooms.reconnect_timeout_seconds
-- sin reportarse (ver remove-player Edge Function).

alter table players add column last_seen_at timestamptz not null default now();

-- SECURITY DEFINER porque players no tiene políticas de UPDATE para
-- clientes (todo escribe por service role) — esta función es la única
-- excepción deliberada, y solo puede tocar last_seen_at de la fila del
-- propio jugador autenticado (verificado con auth.uid() adentro).
create or replace function public.heartbeat(p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update players
  set last_seen_at = now()
  where id = p_player_id
    and user_id = auth.uid();
end;
$$;

revoke all on function public.heartbeat(uuid) from public;
grant execute on function public.heartbeat(uuid) to authenticated;
