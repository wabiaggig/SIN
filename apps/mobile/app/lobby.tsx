import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { createRoom, joinRoom } from "../lib/functions";
import { supabase } from "../lib/supabase";
import { PressableScale } from "../components/PressableScale";

/** Convierte texto de un campo de precio a número; vacío/inválido cae al default del backend. */
function parseAmount(text: string, fallback: number): number {
  const normalized = text.trim().replace(",", ".");
  if (!normalized) return fallback;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export default function Lobby() {
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [entryAmount, setEntryAmount] = useState("1");
  const [reentryWithSin, setReentryWithSin] = useState("1");
  const [reentryWithoutSin, setReentryWithoutSin] = useState("0.5");
  const [busy, setBusy] = useState<"create" | "join" | null>(null);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!displayName.trim() || !roomName.trim()) {
      setError("Completá tu nombre y el nombre de la sala.");
      return;
    }
    setError("");
    setBusy("create");
    try {
      const room = await createRoom({
        name: roomName.trim(),
        maxPlayers: 8,
        initialEntryAmount: parseAmount(entryAmount, 1),
        reentryWithSinAmount: parseAmount(reentryWithSin, 1),
        reentryWithoutSinAmount: parseAmount(reentryWithoutSin, 0.5),
      });
      await joinRoom({ inviteCode: room.inviteCode, displayName: displayName.trim() });
      router.push(`/room/${room.gameId}`);
    } catch (err) {
      setError((err as { message?: string }).message ?? "No se pudo crear la sala.");
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    if (!displayName.trim() || !inviteCode.trim()) {
      setError("Completá tu nombre y el código de sala.");
      return;
    }
    setError("");
    setBusy("join");
    try {
      const result = await joinRoom({ inviteCode: inviteCode.trim().toUpperCase(), displayName: displayName.trim() });
      router.push(`/room/${result.gameId}`);
    } catch (err) {
      setError((err as { message?: string }).message ?? "No se pudo unir a la sala.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>SIN</Text>

      <TextInput
        style={styles.input}
        placeholder="Tu nombre en la mesa"
        value={displayName}
        onChangeText={setDisplayName}
        accessibilityLabel="Tu nombre en la mesa"
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Crear sala</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre de la sala"
          value={roomName}
          onChangeText={setRoomName}
          accessibilityLabel="Nombre de la sala"
        />
        <View style={styles.priceRow}>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Entrada</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              keyboardType="decimal-pad"
              value={entryAmount}
              onChangeText={setEntryAmount}
              accessibilityLabel="Precio de entrada"
            />
          </View>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Reingreso con SIN</Text>
            <TextInput
              style={styles.input}
              placeholder="1"
              keyboardType="decimal-pad"
              value={reentryWithSin}
              onChangeText={setReentryWithSin}
              accessibilityLabel="Precio de reingreso con SIN"
            />
          </View>
          <View style={styles.priceField}>
            <Text style={styles.priceLabel}>Reingreso sin SIN</Text>
            <TextInput
              style={styles.input}
              placeholder="0.5"
              keyboardType="decimal-pad"
              value={reentryWithoutSin}
              onChangeText={setReentryWithoutSin}
              accessibilityLabel="Precio de reingreso sin SIN"
            />
          </View>
        </View>
        <PressableScale
          style={styles.button}
          onPress={handleCreate}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Crear sala"
          accessibilityState={{ disabled: busy !== null, busy: busy === "create" }}
        >
          {busy === "create" ? <ActivityIndicator color="#0f2418" /> : <Text style={styles.buttonText}>Crear</Text>}
        </PressableScale>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Unirse con código</Text>
        <TextInput
          style={styles.input}
          placeholder="CÓDIGO"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
          accessibilityLabel="Código de sala"
        />
        <PressableScale
          style={styles.button}
          onPress={handleJoin}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Unirme a la sala"
          accessibilityState={{ disabled: busy !== null, busy: busy === "join" }}
        >
          {busy === "join" ? <ActivityIndicator color="#0f2418" /> : <Text style={styles.buttonText}>Unirme</Text>}
        </PressableScale>
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()} accessibilityRole="button" accessibilityLabel="Cerrar sesión">
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#0f2418", gap: 16 },
  title: { fontSize: 36, fontWeight: "800", color: "#f5c542", textAlign: "center", marginBottom: 8 },
  card: {
    backgroundColor: "#183a29",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 2,
  },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: "#0f2418",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  priceRow: { flexDirection: "row", gap: 8 },
  priceField: { flex: 1, gap: 4 },
  priceLabel: { color: "#8fb09e", fontSize: 11, fontWeight: "600" },
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
  buttonText: { color: "#0f2418", fontWeight: "700", fontSize: 16 },
  error: { color: "#ff6b6b", textAlign: "center" },
  signOut: { alignItems: "center", marginTop: 12 },
  signOutText: { color: "#cfe3d8", textDecorationLine: "underline" },
});
