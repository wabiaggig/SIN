-- Actualiza apply_game_command para persistir round_results (agregado en
-- 0009) — necesario para que la resolución post-golpe sobreviva entre
-- llamadas HTTP separadas (una por jugador que resuelve).
create or replace function apply_game_command(
  p_game_id uuid,
  p_expected_version bigint,
  p_game jsonb,
  p_players jsonb,
  p_hands jsonb,
  p_table_groups jsonb,
  p_secrets jsonb,
  p_events jsonb
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_version bigint;
  v_player jsonb;
  v_hand jsonb;
  v_group jsonb;
  v_card jsonb;
  v_group_id uuid;
  v_position int;
  v_event jsonb;
begin
  perform 1 from games where id = p_game_id and version = p_expected_version for update;
  if not found then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  v_new_version := p_expected_version + 1;

  update games set
    phase = p_game ->> 'phase',
    round_number = (p_game ->> 'roundNumber')::int,
    active_player_id = nullif(p_game ->> 'activePlayerId', '')::uuid,
    dealer_player_id = (p_game ->> 'dealerPlayerId')::uuid,
    knocker_player_id = nullif(p_game ->> 'knockerPlayerId', '')::uuid,
    pot_amount = (p_game ->> 'potAmount')::numeric,
    winner_player_id = nullif(p_game ->> 'winnerPlayerId', '')::uuid,
    win_type = p_game ->> 'winType',
    current_turn_has_drawn = (p_game ->> 'currentTurnHasDrawn')::boolean,
    current_turn_has_taken_discard = (p_game ->> 'currentTurnHasTakenDiscard')::boolean,
    resolution_order = coalesce(
      (select array_agg(value::uuid) from jsonb_array_elements_text(p_game -> 'resolutionOrder')),
      '{}'
    ),
    resolution_index = (p_game ->> 'resolutionIndex')::int,
    round_results = coalesce(p_game -> 'roundResults', '[]'::jsonb),
    draw_pile_count = (p_game ->> 'drawPileCount')::int,
    discard_top_card = p_game -> 'discardTopCard',
    awaiting_dealer_opening_discard = (p_game ->> 'awaitingDealerOpeningDiscard')::boolean,
    version = v_new_version,
    updated_at = now()
  where id = p_game_id;

  for v_player in select * from jsonb_array_elements(p_players)
  loop
    update players set
      status = v_player ->> 'status',
      accumulated_points = (v_player ->> 'accumulatedPoints')::int,
      current_round_points = nullif(v_player ->> 'currentRoundPoints', '')::int,
      cross_state = v_player ->> 'crossState',
      has_ever_flown = (v_player ->> 'hasEverFlown')::boolean,
      reentry_count = (v_player ->> 'reentryCount')::int,
      total_paid = (v_player ->> 'totalPaid')::numeric,
      total_won = (v_player ->> 'totalWon')::numeric,
      has_completed_first_turn = (v_player ->> 'hasCompletedFirstTurn')::boolean,
      hand_count = (v_player ->> 'handCount')::int
    where id = (v_player ->> 'id')::uuid and game_id = p_game_id;
  end loop;

  for v_hand in select * from jsonb_array_elements(p_hands)
  loop
    insert into player_hands (player_id, cards)
    values ((v_hand ->> 'playerId')::uuid, v_hand -> 'cards')
    on conflict (player_id) do update set cards = excluded.cards;
  end loop;

  delete from table_groups where game_id = p_game_id;
  for v_group in select * from jsonb_array_elements(p_table_groups)
  loop
    v_group_id := (v_group ->> 'id')::uuid;
    insert into table_groups (id, game_id, type, created_by_player_id, locked)
    values (
      v_group_id,
      p_game_id,
      v_group ->> 'type',
      (v_group ->> 'createdByPlayerId')::uuid,
      (v_group ->> 'locked')::boolean
    );

    v_position := 0;
    for v_card in select * from jsonb_array_elements(v_group -> 'cards')
    loop
      insert into table_group_cards (table_group_id, position, card, owner_player_id, joker_represents_rank)
      values (
        v_group_id,
        v_position,
        v_card -> 'card',
        (v_card ->> 'ownerPlayerId')::uuid,
        v_card ->> 'jokerRepresentsRank'
      );
      v_position := v_position + 1;
    end loop;
  end loop;

  update game_secrets set
    draw_pile = p_secrets -> 'drawPile',
    discard_pile = p_secrets -> 'discardPile'
  where game_id = p_game_id;

  for v_event in select * from jsonb_array_elements(p_events)
  loop
    insert into game_events (game_id, type, payload)
    values (p_game_id, v_event ->> 'type', v_event);
  end loop;

  return v_new_version;
end;
$$;

revoke execute on function apply_game_command(uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from public;
revoke execute on function apply_game_command(uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from authenticated;
revoke execute on function apply_game_command(uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function apply_game_command(uuid, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;
