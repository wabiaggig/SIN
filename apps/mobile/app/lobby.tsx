import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { createRoom, joinRoom } from "../lib/functions";
import { supabase } from "../lib/supabase";

export default function Lobby() {
  const [displayName, setDisplayName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
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
      const room = await createRoom({ name: roomName.trim(), maxPlayers: 8 });
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
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Crear sala</Text>
        <TextInput
          style={styles.input}
          placeholder="Nombre de la sala"
          value={roomName}
          onChangeText={setRoomName}
        />
        <Pressable style={styles.button} onPress={handleCreate} disabled={busy !== null}>
          {busy === "create" ? <ActivityIndicator color="#0f2418" /> : <Text style={styles.buttonText}>Crear</Text>}
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Unirse con código</Text>
        <TextInput
          style={styles.input}
          placeholder="CÓDIGO"
          autoCapitalize="characters"
          value={inviteCode}
          onChangeText={setInviteCode}
        />
        <Pressable style={styles.button} onPress={handleJoin} disabled={busy !== null}>
          {busy === "join" ? <ActivityIndicator color="#0f2418" /> : <Text style={styles.buttonText}>Unirme</Text>}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable style={styles.signOut} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.signOutText}>Cerrar sesión</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, backgroundColor: "#0f2418", gap: 16 },
  title: { fontSize: 36, fontWeight: "800", color: "#f5c542", textAlign: "center", marginBottom: 8 },
  card: { backgroundColor: "#183a29", borderRadius: 16, padding: 16, gap: 10 },
  cardTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  input: {
    backgroundColor: "#0f2418",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
  },
  button: { backgroundColor: "#f5c542", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonText: { color: "#0f2418", fontWeight: "700", fontSize: 16 },
  error: { color: "#ff6b6b", textAlign: "center" },
  signOut: { alignItems: "center", marginTop: 12 },
  signOutText: { color: "#cfe3d8", textDecorationLine: "underline" },
});
