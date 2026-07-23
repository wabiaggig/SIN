import { useEffect, useState } from "react";
import { supabase } from "./supabase";

/**
 * Trackea qué user_id están conectados a un canal de presencia de
 * Supabase Realtime en este momento. No es reconexión completa (no hay
 * expulsión por timeout todavía, ver docs/README de supabase), pero es
 * la parte visible: saber quién está en línea ahora mismo.
 */
export function usePresence(channelKey: string, userId: string | null): Set<string> {
  const [online, setOnline] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(`presence-${channelKey}`, {
      config: { presence: { key: userId } },
    });

    function syncState() {
      const state = channel.presenceState<{ user_id: string }>();
      setOnline(new Set(Object.keys(state)));
    }

    channel
      .on("presence", { event: "sync" }, syncState)
      .on("presence", { event: "join" }, syncState)
      .on("presence", { event: "leave" }, syncState)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [channelKey, userId]);

  return online;
}
