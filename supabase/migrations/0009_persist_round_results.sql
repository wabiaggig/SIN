-- Bug real encontrado al preparar el smoke test de deuda por codillo:
-- durante resolving_knock, cada jugador confirma su resolución en una
-- llamada HTTP separada a game-command. roundResults se acumula en
-- memoria dentro de una sola invocación de processCommand() (ver
-- advanceResolution en game-engine/src/commands.ts), pero como cada
-- llamada recarga el GameState desde cero, sin esta columna se perdía
-- todo lo acumulado por los jugadores anteriores en cada nueva llamada.
alter table games
  add column round_results jsonb not null default '[]';
