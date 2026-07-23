import { useEffect } from "react";
import { supabase } from "./supabase";

const HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Reporta periódicamente players.last_seen_at para el propio jugador
 * mientras la pantalla está montada. Es la señal durable de conexión
 * (sobrevive a reconexiones del socket de Realtime) que remove-player usa
 * server-side para decidir si alguien lleva más de
 * rooms.reconnect_timeout_seconds desconectado (§56).
 */
export function useHeartbeat(playerId: string | null) {
  useEffect(() => {
    if (!playerId) return;

    function beat() {
      supabase.rpc("heartbeat", { p_player_id: playerId }).then(({ error }) => {
        if (error) console.warn("heartbeat failed", error.message);
      });
    }

    beat();
    const interval = setInterval(beat, HEARTBEAT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [playerId]);
}
