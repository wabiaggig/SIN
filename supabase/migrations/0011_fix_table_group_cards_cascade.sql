-- Bug real encontrado al limpiar datos de prueba: borrar una sala fallaba
-- con una violación de FK ("table_group_cards_owner_player_id_fkey")
-- porque table_group_cards.owner_player_id → players(id) no tenía
-- ON DELETE CASCADE (a diferencia de table_group_id, que sí lo tenía).
-- Dentro de una misma transacción de cascada desde rooms → games,
-- Postgres puede borrar players antes que table_group_cards, y sin
-- cascada esa fila de players queda "todavía referenciada".
alter table table_group_cards
  drop constraint table_group_cards_owner_player_id_fkey,
  add constraint table_group_cards_owner_player_id_fkey
    foreign key (owner_player_id) references players (id) on delete cascade;

-- Mismo problema potencial en table_groups.created_by_player_id.
alter table table_groups
  drop constraint table_groups_created_by_player_id_fkey,
  add constraint table_groups_created_by_player_id_fkey
    foreign key (created_by_player_id) references players (id) on delete cascade;
