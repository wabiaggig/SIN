-- Campo agregado al motor (game-engine/src/dealing.ts) después de la
-- migración 0001: el repartidor descarta sin haber robado, y ese
-- descarte no cuenta como turno completo (PROMPT.md §8, §10).
alter table games
  add column awaiting_dealer_opening_discard boolean not null default false;
