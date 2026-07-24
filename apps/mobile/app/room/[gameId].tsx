import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../lib/supabase";
import { confirmEntry, startGame, removeLobbyPlayer } from "../../lib/functions";
import { usePresence } from "../../lib/usePresence";
import { useHeartbeat } from "../../lib/useHeartbeat";
import { isDisconnected, secondsSinceLastSeen, useNowTicker } from "../../lib/reconnection";
import { PressableScale } from "../../components/PressableScale";

type PlayerRow = {
  id: string;
  user_id: string;
  display_name: string;
  seat_index: number;
  status: string;
  last_seen_at: string;
};

type GameRow = { id: string; room_id: string; phase: string };
type RoomRow = {
  id: string;
  invite_code: string;
  host_user_id: string;
  max_players: number;
  reconnect_timeout_seconds: number;
};

export default function Room() {
  const { gameId } = useLocalSearchParams<{ gameId: string }>();
  const [game, setGame] = useState<GameRow | null>(null);
  const [room, setRoom] = useState<RoomRow | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    setUserId(userData.user?.id ?? null);

    const { data: gameRow, error: gameError } = await supabase
      .from("games")
      .select("id, room_id, phase")
      .eq("id", gameId)
      .single();
    if (!gameRow) {
      setError(gameError?.message ?? "No se pudo cargar la partida (¿ya te uniste?).");
      setLoading(false);
      return;
    }
    setGame(gameRow);

    const { data: roomRow } = await supabase
      .from("rooms")
      .select("id, invite_code, host_user_id, max_players, reconnect_timeout_seconds")
      .eq("id", gameRow.room_id)
      .single();
    setRoom(roomRow);

    const { data: playerRows } = await supabase
      .from("players")
      .select("id, user_id, display_name, seat_index, status, last_seen_at")
      .eq("game_id", gameId)
      .order("seat_index", { ascending: true });
    setPlayers(playerRows ?? []);
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel(`room-${gameId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `game_id=eq.${gameId}` }, loadAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, loadAll]);

  useEffect(() => {
    if (game && game.phase !== "lobby" && game.phase !== "waiting_for_entries") {
      router.replace(`/table/${gameId}`);
    }
  }, [game, gameId]);

  const onlineUserIds = usePresence(gameId!, userId);
  const me = players.find((p) => p.user_id === userId);
  useHeartbeat(me?.id ?? null);
  const nowTick = useNowTicker();
  const isHost = room?.host_user_id === userId;
  const activeCount = players.filter((p) => p.status === "active").length;

  function isPlayerDisconnected(player: PlayerRow) {
    return !!room && isDisconnected(player.last_seen_at, room.reconnect_timeout_seconds, nowTick);
  }

  async function handleKick(targetPlayerId: string) {
    setError("");
    setBusy(true);
    try {
      await removeLobbyPlayer({ gameId: gameId!, targetPlayerId });
    } catch (err) {
      setError((err as { message?: string }).message ?? "No se pudo expulsar al jugador.");
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    setError("");
    setBusy(true);
    try {
      await confirmEntry({ gameId: gameId! });
    } catch (err) {
      setError((err as { message?: string }).message ?? "No se pudo confirmar la entrada.");
    } finally {
      setBusy(false);
    }
  }

  async function handleStart() {
    setError("");
    setBusy(true);
    try {
      await startGame({ gameId: gameId! });
    } catch (err) {
      setError((err as { message?: string }).message ?? "No se pudo iniciar la partida.");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && error && !game) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  if (loading || !game || !room) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f5c542" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.code}>{room.invite_code}</Text>
      <Text style={styles.hint}>Compartí este código para que se unan</Text>
      <Text style={styles.phase}>Estado: {game.phase}</Text>

      <View style={styles.playerList}>
        {players.map((p) => (
          <View key={p.id} style={styles.playerRow}>
            <View style={styles.playerNameRow}>
              <View
                style={[styles.onlineDot, onlineUserIds.has(p.user_id) ? styles.onlineDotOn : styles.onlineDotOff]}
                accessibilityLabel={onlineUserIds.has(p.user_id) ? "conectado" : "sin conexión"}
              />
              <Text style={styles.playerName}>
                {p.display_name}
                {p.user_id === room.host_user_id ? " 👑" : ""}
              </Text>
            </View>
            <Text style={[styles.playerStatus, p.status === "active" ? styles.statusActive : styles.statusWaiting]}>
              {p.status === "active" ? "confirmado" : "esperando"}
            </Text>
            {isHost && p.user_id !== userId && isPlayerDisconnected(p) ? (
              <Pressable
                style={styles.kickButton}
                disabled={busy}
                onPress={() => handleKick(p.id)}
                accessibilityRole="button"
                accessibilityLabel={`Expulsar a ${p.display_name}`}
                accessibilityState={{ disabled: busy }}
              >
                <Text style={styles.kickButtonText}>
                  Expulsar ({secondsSinceLastSeen(p.last_seen_at, nowTick)}s desconectado)
                </Text>
              </Pressable>
            ) : null}
          </View>
        ))}
      </View>

      {me?.status === "waiting" ? (
        <PressableScale
          style={styles.button}
          onPress={handleConfirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Confirmar entrada"
          accessibilityState={{ disabled: busy, busy }}
        >
          {busy ? <ActivityIndicator color="#0f2418" /> : <Text style={styles.buttonText}>Confirmar entrada</Text>}
        </PressableScale>
      ) : null}

      {isHost && (game.phase === "lobby" || game.phase === "waiting_for_entries") ? (
        <PressableScale
          style={[styles.button, activeCount < 3 && styles.buttonDisabled]}
          onPress={handleStart}
          disabled={busy || activeCount < 3}
          accessibilityRole="button"
          accessibilityLabel="Iniciar partida"
          accessibilityState={{ disabled: busy || activeCount < 3, busy }}
        >
          {busy ? (
            <ActivityIndicator color="#0f2418" />
          ) : (
            <Text style={styles.buttonText}>
              Iniciar partida {activeCount < 3 ? `(faltan ${3 - activeCount})` : ""}
            </Text>
          )}
        </PressableScale>
      ) : null}

      {game.phase === "playing" ? <Text style={styles.playing}>¡La partida arrancó! 🎉</Text> : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: "#0f2418", gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0f2418" },
  code: { fontSize: 40, fontWeight: "800", color: "#f5c542", textAlign: "center", letterSpacing: 4 },
  hint: { color: "#cfe3d8", textAlign: "center", marginBottom: 8 },
  phase: { color: "#8fb09e", textAlign: "center", marginBottom: 16 },
  playerList: { gap: 8, marginBottom: 16 },
  playerRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#183a29",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 1,
  },
  kickButton: { backgroundColor: "#e0573f", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  kickButtonText: { color: "#fff", fontWeight: "700", fontSize: 12, textAlign: "center" },
  playerNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  playerName: { color: "#fff", fontSize: 16 },
  onlineDot: { width: 8, height: 8, borderRadius: 4 },
  onlineDotOn: { backgroundColor: "#6fcf97" },
  onlineDotOff: { backgroundColor: "#5a5a5a" },
  playerStatus: { fontSize: 13, fontWeight: "600" },
  statusActive: { color: "#6fcf97" },
  statusWaiting: { color: "#f2c94c" },
  button: {
    backgroundColor: "#f5c542",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#0f2418", fontWeight: "700", fontSize: 16 },
  playing: { color: "#6fcf97", textAlign: "center", fontSize: 18, marginTop: 16 },
  error: { color: "#ff6b6b", textAlign: "center" },
});
