-- Limpieza de las tablas usadas para diagnosticar el bug de políticas RLS
-- auto-referenciales en Realtime (ver 0006). No son parte del esquema del
-- juego.
drop table if exists rt_probe_self;
drop table if exists rt_probe_child;
drop table if exists rt_probe_owner;
drop table if exists rt_probe;
