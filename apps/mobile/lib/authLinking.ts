import { useEffect } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import { supabase } from "./supabase";

/**
 * En web, detectSessionInUrl se encarga solo. En nativo no hay URL de
 * navegador que inspeccionar — Supabase redirige al enlace mágico a
 * nuestro esquema "sin://" con los tokens en el fragmento/query, y acá
 * los tomamos a mano para armar la sesión.
 */
function extractTokensFromUrl(url: string): { access_token: string; refresh_token: string } | null {
  const hashIndex = url.indexOf("#");
  const paramsString = hashIndex >= 0 ? url.slice(hashIndex + 1) : url.split("?")[1];
  if (!paramsString) return null;
  const params = new URLSearchParams(paramsString);
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  if (!access_token || !refresh_token) return null;
  return { access_token, refresh_token };
}

async function handleIncomingUrl(url: string) {
  const tokens = extractTokensFromUrl(url);
  if (!tokens) return;
  await supabase.auth.setSession(tokens);
}

/** Solo hace algo en nativo — en web es un no-op seguro. */
export function useAuthDeepLinking() {
  useEffect(() => {
    if (Platform.OS === "web") return;

    Linking.getInitialURL().then((url) => {
      if (url) handleIncomingUrl(url);
    });

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => subscription.remove();
  }, []);
}
