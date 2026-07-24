import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";
import { PressableScale } from "../components/PressableScale";

export default function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.spring(rise, { toValue: 0, useNativeDriver: true, speed: 10, bounciness: 6 }),
    ]).start();
  }, [fade, rise]);

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
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
        <View style={styles.titleRow}>
          <Text style={styles.suitAccent}>♠</Text>
          <Text style={styles.title}>SIN</Text>
          <Text style={[styles.suitAccent, styles.suitAccentRed]}>♥</Text>
        </View>
        <Text style={styles.subtitle}>Ingresá con tu email — te mandamos un enlace mágico, sin contraseña.</Text>

        {status === "sent" ? (
          <Text style={styles.sent} accessibilityLiveRegion="polite">
            Revisá tu correo ({email}) y tocá el enlace para entrar.
          </Text>
        ) : (
          <>
            <TextInput
              style={styles.input}
              placeholder="tu@email.com"
              placeholderTextColor="#6f8f80"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={status !== "sending"}
              accessibilityLabel="Email"
            />
            <PressableScale
              style={[styles.button, status === "sending" && styles.buttonDisabled]}
              onPress={sendMagicLink}
              disabled={status === "sending"}
              accessibilityRole="button"
              accessibilityLabel="Enviar enlace mágico"
              accessibilityState={{ disabled: status === "sending", busy: status === "sending" }}
            >
              {status === "sending" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Enviar enlace mágico</Text>
              )}
            </PressableScale>
            {status === "error" ? <Text style={styles.error}>{errorMessage}</Text> : null}
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "#0f2418" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 },
  title: { fontSize: 48, fontWeight: "800", color: "#f5c542", textAlign: "center" },
  suitAccent: { fontSize: 28, color: "#f5c54277" },
  suitAccentRed: { color: "#c0392b77" },
  subtitle: { fontSize: 15, color: "#cfe3d8", textAlign: "center", marginBottom: 32 },
  input: {
    backgroundColor: "#183a29",
    color: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ffffff14",
  },
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
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#0f2418", fontWeight: "700", fontSize: 16 },
  sent: { color: "#cfe3d8", textAlign: "center", fontSize: 16, lineHeight: 22 },
  error: { color: "#ff6b6b", marginTop: 12, textAlign: "center" },
});
