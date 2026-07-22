-- Deuda de entradas tras codillo (PROMPT.md §41): el jugador expulsado
-- por codillo debe pagar las entradas de quienes participen en la
-- siguiente partida de la misma sala. Un solo deudor pendiente a la vez
-- es suficiente: solo puede haber un codillo por ronda, y la deuda se
-- salda en cuanto arranca la siguiente partida (start-game).
alter table rooms
  add column codillo_debtor_user_id uuid references auth.users (id);
