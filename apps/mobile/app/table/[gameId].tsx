import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { usePresence } from "../../lib/usePresence";
import { gameCommand, createNextGame, joinRoom, startNextRound } from "../../lib/functions";
import { PlayingCard } from "../../components/PlayingCard";
import { DraggableHand } from "../../components/DraggableHand";
import { handPoints } from "../../lib/cardDisplay";
import { hasSin, statusColor, statusLabel } from "../../lib/playerStatus";
import { describeEvent } from "../../lib/eventLabels";
import type { Card, GameRow, PlayerRow, RoomRow, TableGroup } from "../../lib/types";

type EventRow = { id: number; type: string; payload: Record<string, unknown>; created_at: string };

const WIN_TYPE_LABEL: Record<string, string> = {
  normal: "Normal",
  sin: "¡Con SIN! 🎉",
  royal: "¡Royal! 👑",
  royal_with_sin: "¡Royal con SIN! 👑🎉",
};

const MAX_SCORE = 69;

export default function Table() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<GameRow | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [hand, setHand] = useState<Card[]>([]);
  const [tableGroups, setTableGroups] = useState<TableGroup[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const uid = userData.user?.id ?? null;
    setUserId(uid);

    const { data: gameRow } = await supabase
      .from("games")
      .select(
        "id, room_id, phase, active_player_id, dealer_player_id, knocker_player_id, current_turn_has_drawn, current_turn_has_taken_discard, awaiting_dealer_opening_discard, draw_pile_count, discard_top_card, pot_amount, round_number, resolution_order, resolution_index, winner_player_id, win_type",
      )
      .eq("id", gameId)
      .single();
    if (!gameRow) return;
    setGame(gameRow as GameRow);

    const { data: roomRow } = await supabase
      .from("rooms")
      .select("id, host_user_id, invite_code, currency_symbol, initial_entry_amount, sin_bonus_amount_per_opponent, codillo_debtor_user_id")
      .eq("id", gameRow.room_id)
      .single();
    setRoom((roomRow as RoomRow) ?? null);

    const { data: playerRows } = await supabase
      .from("players")
      .select("id, user_id, display_name, seat_index, status, accumulated_points, cross_state, has_ever_flown, hand_count")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });
    setPlayers((playerRows ?? []) as PlayerRow[]);

    const me = (playerRows ?? []).find((p: PlayerRow) => p.user_id === uid);
    if (me) {
      const { data: handRow } = await supabase.from("player_hands").select("cards").eq("player_id", me.id).single();
      setHand((handRow?.cards ?? []) as Card[]);
    }

    const { data: groupRows } = await supabase.from("table_groups").select("id, type, created_by_player_id, locked").eq("game_id", gameId);
    const groupIds = (groupRows ?? []).map((g: { id: string }) => g.id);
    const { data: groupCardRows } = groupIds.length
      ? await supabase
          .from("table_group_cards")
          .select("table_group_id, position, card, owner_player_id, joker_represents_rank")
          .in("table_group_id", groupIds)
          .order("position", { ascending: true })
      : { data: [] };
    const groups: TableGroup[] = (groupRows ?? []).map((g: any) => ({
      id: g.id,
      type: g.type,
      createdByPlayerId: g.created_by_player_id,
      locked: g.locked,
      cards: (groupCardRows ?? [])
        .filter((c: any) => c.table_group_id === g.id)
        .map((c: any) => ({ card: c.card, ownerPlayerId: c.owner_player_id, jokerRepresentsRank: c.joker_represents_rank })),
    }));
    setTableGroups(groups);
    setLoading(false);
  }, [gameId]);

  const loadEvents = useCallback(async () => {
    const { data } = await supabase
      .from("game_events")
      .select("id, type, payload, created_at")
      .eq("game_id", gameId)
      .order("id", { ascending: false })
      .limit(50);
    setEvents((data ?? []) as EventRow[]);
  }, [gameId]);

  useEffect(() => {
    loadEvents();
    const channel = supabase
      .channel(`table-events-${gameId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `game_id=eq.${gameId}` },
        (payload: any) => setEvents((prev) => [payload.new as EventRow, ...prev].slice(0, 50)),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, loadEvents]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`table-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_hands" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_groups", filter: `game_id=eq.${gameId}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "table_group_cards" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, load]);

  // Cuando el anfitrión crea una partida nueva en la misma sala (tras
  // "finished"), el resto de los jugadores la detecta acá y se redirige solo.
  useEffect(() => {
    if (!room) return;
    const channel = supabase
      .channel(`room-watch-${room.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "games", filter: `room_id=eq.${room.id}` },
        (payload: any) => {
          const newId = payload.new?.id;
          if (newId && newId !== gameId) {
            router.replace(`/room/${newId}`);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [room, gameId]);

  const onlineUserIds = usePresence(gameId!, userId);
  const me = useMemo(() => players.find((p) => p.user_id === userId), [players, userId]);
  const isHost = !!room && room.host_user_id === userId;
  const isMyTurn = !!me && game?.active_player_id === me.id;
  const isPlaying = game?.phase === "playing";
  const isResolving = game?.phase === "resolving_knock";
  const myHandPoints = handPoints(hand);
  const margin = me ? MAX_SCORE - me.accumulated_points : 0;

  const canDrawOrTake =
    isPlaying && isMyTurn && !game!.current_turn_has_drawn && !game!.current_turn_has_taken_discard && !game!.awaiting_dealer_opening_discard;
  const canDiscard =
    isPlaying &&
    isMyTurn &&
    (game!.current_turn_has_drawn ||
      game!.current_turn_has_taken_discard ||
      (game!.awaiting_dealer_opening_discard && game!.dealer_player_id === me?.id));
  const canPlayGroups = (isPlaying && isMyTurn && (game!.current_turn_has_drawn || game!.current_turn_has_taken_discard)) || (isResolving && isMyTurn);
  const canKnock = canDrawOrTake;

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function run(command: Record<string, unknown>) {
    if (!me) return;
    setError("");
    setBusy(true);
    try {
      await gameCommand({ gameId: gameId!, command: { ...command, playerId: me.id } });
      setSelected(new Set());
    } catch (err) {
      setError((err as { message?: string }).message ?? "Acción rechazada.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !game) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f5c542" />
      </View>
    );
  }

  if (game.phase === "waiting_for_reentry_decisions" && me?.status === "flown_pending_reentry") {
    return (
      <View style={styles.center}>
        <Text style={styles.bigText}>Volaste 🪽</Text>
        <Pressable
          style={styles.centerButton}
          disabled={busy}
          onPress={() => run({ type: "REENTER" })}
          accessibilityRole="button"
          accessibilityLabel="Reingresar a la ronda"
          accessibilityState={{ disabled: busy, busy }}
        >
          <Text style={styles.actionText}>Reingresar</Text>
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  if (game.phase === "waiting_for_reentry_decisions") {
    const pending = players.filter((p) => p.status === "flown_pending_reentry");
    return (
      <View style={styles.center}>
        <Text style={styles.bigText}>Golpe resuelto</Text>
        {pending.length > 0 ? (
          <Text style={styles.marginText}>
            Esperando a que decida{pending.length > 1 ? "n" : ""}: {pending.map((p) => p.display_name).join(", ")}
          </Text>
        ) : isHost ? (
          <Pressable
            style={styles.centerButton}
            disabled={busy}
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                await startNextRound({ gameId: gameId! });
              } catch (err) {
                setError((err as { message?: string }).message ?? "No se pudo repartir la siguiente ronda.");
              } finally {
                setBusy(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Repartir siguiente ronda"
            accessibilityState={{ disabled: busy, busy }}
          >
            <Text style={styles.actionText}>Repartir siguiente ronda</Text>
          </Pressable>
        ) : (
          <Text style={styles.marginText}>Esperando a que el anfitrión reparta la siguiente ronda…</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  if (game.phase === "finished") {
    const winner = players.find((p) => p.id === game.winner_player_id);
    const opponents = players.filter((p) => p.id !== game.winner_player_id);
    const isSinWin = game.win_type === "sin" || game.win_type === "royal_with_sin";
    const sinBonusTotal = isSinWin && room ? room.sin_bonus_amount_per_opponent * opponents.length : 0;
    const totalPrize = game.pot_amount + sinBonusTotal;
    const debtor = room?.codillo_debtor_user_id ? players.find((p) => p.user_id === room.codillo_debtor_user_id) : null;

    return (
      <View style={styles.center}>
        <Text style={styles.bigText}>🏆 Ganó {winner?.display_name ?? "…"}</Text>
        <Text style={styles.marginText}>{WIN_TYPE_LABEL[game.win_type ?? "normal"]}</Text>
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pozo</Text>
            <Text style={styles.summaryValue}>
              {room?.currency_symbol} {game.pot_amount}
            </Text>
          </View>
          {isSinWin ? (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Bono SIN ({opponents.length} rival{opponents.length !== 1 ? "es" : ""})</Text>
              <Text style={styles.summaryValue}>
                {room?.currency_symbol} {sinBonusTotal}
              </Text>
            </View>
          ) : null}
          <View style={[styles.summaryRow, styles.summaryTotalRow]}>
            <Text style={styles.summaryLabel}>Total para {winner?.display_name}</Text>
            <Text style={styles.summaryValue}>
              {room?.currency_symbol} {totalPrize}
            </Text>
          </View>
        </View>
        {debtor ? (
          <Text style={styles.hint}>
            {debtor.display_name} quedó afuera por codillo — paga las entradas de la próxima partida.
          </Text>
        ) : null}
        {isHost ? (
          <Pressable
            style={styles.centerButton}
            disabled={busy}
            onPress={async () => {
              if (!room) return;
              setBusy(true);
              setError("");
              try {
                const next = await createNextGame({ roomId: room.id });
                // El anfitrión tampoco tiene asiento automático en la partida
                // nueva (igual que en create-room) — se une antes de navegar.
                await joinRoom({ inviteCode: room.invite_code, displayName: me?.display_name ?? "Anfitrión" });
                router.replace(`/room/${next.gameId}`);
              } catch (err) {
                setError((err as { message?: string }).message ?? "No se pudo crear la siguiente partida.");
              } finally {
                setBusy(false);
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Jugar de nuevo"
            accessibilityState={{ disabled: busy, busy }}
          >
            <Text style={styles.actionText}>Jugar de nuevo</Text>
          </Pressable>
        ) : (
          <Text style={styles.marginText}>Esperando a que el anfitrión inicie una nueva partida…</Text>
        )}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.headerRow}>
          <Text style={styles.pot}>Pozo: {game.pot_amount}</Text>
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Pressable
              onPress={() => setHistoryOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Ver historial de eventos"
            >
              <Text style={styles.link}>Historial</Text>
            </Pressable>
            <Pressable
              onPress={() => run({ type: "SING_SCOREBOARD" }).then(() => setScoreboardOpen(true))}
              accessibilityRole="button"
              accessibilityLabel="Ver tabla de puntajes"
            >
              <Text style={styles.link}>Cantar</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.turnBanner}>
          <Text style={styles.turnText}>
            {isMyTurn ? "Tu turno" : `Turno de ${players.find((p) => p.id === game.active_player_id)?.display_name ?? "…"}`}
          </Text>
          <Text style={styles.marginText}>
            Acumulado {me?.accumulated_points ?? 0} · margen {margin} · mano {myHandPoints}
          </Text>
        </View>

        <View style={styles.pilesRow}>
          <Pressable
            style={styles.pile}
            disabled={!canDrawOrTake || busy}
            onPress={() => run({ type: "DRAW_CARD" })}
            accessibilityRole="button"
            accessibilityLabel={`Robar del mazo, ${game.draw_pile_count} cartas`}
            accessibilityState={{ disabled: !canDrawOrTake || busy }}
          >
            <View style={[styles.cardBack, !canDrawOrTake && styles.disabled]} />
            <Text style={styles.pileLabel}>Mazo ({game.draw_pile_count})</Text>
          </Pressable>

          <Pressable
            style={styles.pile}
            disabled={!canDrawOrTake || !game.discard_top_card || selected.size < 0 || busy}
            onPress={() => {
              if (!game.discard_top_card) return;
              const groupCardIds = [...selected, game.discard_top_card.id];
              run({ type: "TAKE_DISCARD", groupCardIds });
            }}
            accessibilityRole="button"
            accessibilityLabel="Tomar carta del descarte"
            accessibilityState={{ disabled: !canDrawOrTake || !game.discard_top_card || busy }}
          >
            {game.discard_top_card ? (
              <PlayingCard card={game.discard_top_card} />
            ) : (
              <View style={[styles.cardBack, styles.emptyPile]} />
            )}
            <Text style={styles.pileLabel}>Descarte</Text>
          </Pressable>
        </View>

        {tableGroups.length > 0 ? (
          <View style={styles.groupsSection}>
            <Text style={styles.sectionTitle}>Mesa</Text>
            {tableGroups.map((group) => (
              <Pressable
                key={group.id}
                style={styles.groupRow}
                disabled={!canPlayGroups || selected.size !== 1 || busy}
                onPress={() => {
                  const [cardId] = [...selected];
                  if (!cardId) return;
                  run({ type: "ATTACH_CARD", groupId: group.id, cardId });
                }}
                accessibilityRole="button"
                accessibilityLabel="Enchufar carta seleccionada a este grupo"
                accessibilityState={{ disabled: !canPlayGroups || selected.size !== 1 || busy }}
              >
                {group.cards.map((tc) => (
                  <PlayingCard key={tc.card.id} card={tc.card} small />
                ))}
              </Pressable>
            ))}
            {canPlayGroups && selected.size === 1 ? (
              <Text style={styles.hint}>Tocá un grupo para enchufar la carta seleccionada</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.handSection}>
          <Text style={styles.sectionTitle}>Tu mano</Text>
          <Text style={styles.hint}>Arrastrá una carta para ordenarla, o seleccioná una y usá ◀ Mover / Mover ▶</Text>
          {me ? (
            <DraggableHand
              cards={hand}
              selected={selected}
              onToggle={toggleCard}
              storageKey={`sin-hand-order-${gameId}-${me.id}`}
            />
          ) : null}
        </View>
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          style={[styles.actionButton, (!canPlayGroups || selected.size < 3) && styles.disabled]}
          disabled={!canPlayGroups || selected.size < 3 || busy}
          onPress={() => run({ type: "LAY_DOWN_GROUP", cardIds: [...selected] })}
          accessibilityRole="button"
          accessibilityLabel="Bajar grupo"
          accessibilityState={{ disabled: !canPlayGroups || selected.size < 3 || busy }}
        >
          <Text style={styles.actionText}>Bajar</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, (!canDiscard || selected.size !== 1) && styles.disabled]}
          disabled={!canDiscard || selected.size !== 1 || busy}
          onPress={() => run({ type: "DISCARD_CARD", cardId: [...selected][0] })}
          accessibilityRole="button"
          accessibilityLabel="Descartar carta seleccionada"
          accessibilityState={{ disabled: !canDiscard || selected.size !== 1 || busy }}
        >
          <Text style={styles.actionText}>Descartar</Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.knockButton, !canKnock && styles.disabled]}
          disabled={!canKnock || busy}
          onPress={() => run({ type: "KNOCK" })}
          accessibilityRole="button"
          accessibilityLabel="Golpear"
          accessibilityState={{ disabled: !canKnock || busy }}
        >
          <Text style={styles.actionText}>Golpear</Text>
        </Pressable>
        <Pressable
          style={styles.actionButton}
          disabled={busy || hand.length !== 7}
          onPress={() => run({ type: "DECLARE_ROYAL" })}
          accessibilityRole="button"
          accessibilityLabel="Declarar Royal"
          accessibilityState={{ disabled: busy || hand.length !== 7 }}
        >
          <Text style={styles.actionText}>Royal</Text>
        </Pressable>
      </View>

      {isResolving && isMyTurn ? (
        <View style={styles.resolutionBar}>
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => run({ type: "USE_CROSS" })}
            accessibilityRole="button"
            accessibilityLabel="Usar cruz"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.actionText}>Usar cruz</Text>
          </Pressable>
          <Pressable
            style={styles.actionButton}
            disabled={busy}
            onPress={() => run({ type: "CONFIRM_RESOLUTION" })}
            accessibilityRole="button"
            accessibilityLabel="Confirmar resolución"
            accessibilityState={{ disabled: busy }}
          >
            <Text style={styles.actionText}>Confirmar</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={scoreboardOpen} transparent animationType="fade" onRequestClose={() => setScoreboardOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setScoreboardOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sectionTitle}>Tabla</Text>
            <View style={styles.scoreHeaderRow}>
              <Text style={[styles.scoreHeaderCell, styles.scoreNameCol]}>Jugador</Text>
              <Text style={styles.scoreHeaderCell}>Puntaje</Text>
              <Text style={styles.scoreHeaderCell}>Margen</Text>
              <Text style={styles.scoreHeaderCell}>SIN</Text>
              <Text style={[styles.scoreHeaderCell, styles.scoreStatusCol]}>Estado</Text>
            </View>
            {players.map((p) => (
              <View key={p.id} style={styles.scoreRow}>
                <View style={[styles.scoreNameCol, { flexDirection: "row", alignItems: "center", gap: 6 }]}>
                  <View
                    style={[
                      styles.onlineDot,
                      onlineUserIds.has(p.user_id) ? styles.onlineDotOn : styles.onlineDotOff,
                    ]}
                  />
                  <Text style={styles.scoreName} numberOfLines={1}>
                    {p.display_name}
                  </Text>
                </View>
                <Text style={styles.scoreCell}>{p.accumulated_points}</Text>
                <Text style={styles.scoreCell}>{Math.max(0, MAX_SCORE - p.accumulated_points)}</Text>
                <Text style={styles.scoreCell}>{hasSin(p) ? "Sí" : "—"}</Text>
                <View style={styles.scoreStatusCol}>
                  <Text style={[styles.statusBadge, { color: statusColor(p.status) }]}>{statusLabel(p.status)}</Text>
                </View>
              </View>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={historyOpen} transparent animationType="fade" onRequestClose={() => setHistoryOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setHistoryOpen(false)}>
          <Pressable style={[styles.modalCard, styles.historyCard]} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.sectionTitle}>Historial</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {events.length === 0 ? (
                <Text style={styles.hint}>Todavía no hay eventos.</Text>
              ) : (
                events.map((event) => (
                  <View key={event.id} style={styles.historyRow}>
                    <Text style={styles.historyText}>
                      {describeEvent(event.payload as any, (id) => players.find((p) => p.id === id)?.display_name ?? "…")}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0f2418" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f2418", gap: 16 },
  bigText: { color: "#f5c542", fontSize: 24, fontWeight: "800" },
  scrollBody: { padding: 16, gap: 16, paddingBottom: 24 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  pot: { color: "#f5c542", fontWeight: "700", fontSize: 16 },
  link: { color: "#cfe3d8", textDecorationLine: "underline" },
  turnBanner: { alignItems: "center", gap: 4 },
  turnText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  marginText: { color: "#8fb09e", fontSize: 13 },
  pilesRow: { flexDirection: "row", justifyContent: "center", gap: 32 },
  pile: { alignItems: "center", gap: 6 },
  cardBack: { width: 56, height: 78, borderRadius: 8, backgroundColor: "#2c6b4f", borderWidth: 2, borderColor: "#f5c54255" },
  emptyPile: { backgroundColor: "#183a29", borderStyle: "dashed" },
  pileLabel: { color: "#cfe3d8", fontSize: 12 },
  groupsSection: { gap: 10 },
  sectionTitle: { color: "#cfe3d8", fontSize: 14, fontWeight: "700", textTransform: "uppercase" },
  groupRow: { flexDirection: "row", gap: 4, backgroundColor: "#183a29", borderRadius: 10, padding: 8, flexWrap: "wrap" },
  hint: { color: "#f2c94c", fontSize: 12, textAlign: "center" },
  handSection: { gap: 10 },
  hand: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  actionBar: { flexDirection: "row", gap: 8, padding: 12, backgroundColor: "#0a1a12" },
  resolutionBar: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingBottom: 12, backgroundColor: "#0a1a12" },
  actionButton: { flex: 1, backgroundColor: "#f5c542", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  centerButton: { backgroundColor: "#f5c542", borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, alignItems: "center" },
  knockButton: { backgroundColor: "#e07a3f" },
  disabled: { opacity: 0.35 },
  actionText: { color: "#0f2418", fontWeight: "700" },
  error: { color: "#ff6b6b", textAlign: "center", paddingBottom: 8 },
  summaryCard: { backgroundColor: "#183a29", borderRadius: 14, padding: 16, gap: 8, minWidth: 280 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryTotalRow: { borderTopWidth: 1, borderTopColor: "#ffffff22", paddingTop: 8, marginTop: 4 },
  summaryLabel: { color: "#cfe3d8" },
  summaryValue: { color: "#f5c542", fontWeight: "700" },
  modalBackdrop: { flex: 1, backgroundColor: "#00000099", alignItems: "center", justifyContent: "center" },
  modalCard: { backgroundColor: "#183a29", borderRadius: 16, padding: 20, minWidth: 320, gap: 6 },
  scoreHeaderRow: { flexDirection: "row", gap: 4, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: "#ffffff22", paddingBottom: 6 },
  scoreHeaderCell: { flex: 1, color: "#8fb09e", fontSize: 11, fontWeight: "700", textTransform: "uppercase", textAlign: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6 },
  scoreName: { color: "#fff", fontWeight: "600" },
  scoreCell: { flex: 1, color: "#cfe3d8", textAlign: "center" },
  scoreNameCol: { flex: 1.6, textAlign: "left" },
  scoreStatusCol: { flex: 1.4, alignItems: "center" },
  statusBadge: { fontSize: 12, fontWeight: "700", textAlign: "center" },
  historyCard: { maxHeight: 500 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineDotOn: { backgroundColor: "#6fcf97" },
  onlineDotOff: { backgroundColor: "#5a5a5a" },
  historyRow: { paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#ffffff11" },
  historyText: { color: "#cfe3d8", fontSize: 13 },
});
