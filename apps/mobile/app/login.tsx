import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function sendMagicLink() {
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMessage("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: Linking.createURL("/") },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>SIN</Text>
      <Text style={styles.subtitle}>Ingresá con tu email — te mandamos un enlace mágico, sin contraseña.</Text>

      {status === "sent" ? (
        <Text style={styles.sent}>Revisá tu correo ({email}) y tocá el enlace para entrar.</Text>
      ) : (
        <>
          <TextInput
            style={styles.input}
            placeholder="tu@email.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={status !== "sending"}
          />
          <Pressable
            style={[styles.button, status === "sending" && styles.buttonDisabled]}
            onPress={sendMagicLink}
            disabled={status === "sending"}
          >
            {status === "sending" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Enviar enlace mágico</Text>
            )}
          </Pressable>
          {status === "error" ? <Text style={styles.error}>{errorMessage}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f2418" },
  title: { fontSize: 48, fontWeight: "800", color: "#f5c542", textAlign: "center", marginBottom: 8 },
  subtitle: { fontSize: 15, color: "#cfe3d8", textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: "#183a29",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  button: { backgroundColor: "#f5c542", borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f2418", fontWeight: "700", fontSize: 16 },
  sent: { color: "#cfe3d8", textAlign: "center", fontSize: 16, lineHeight: 22 },
  error: { color: "#ff6b6b", marginTop: 12, textAlign: "center" },
});
