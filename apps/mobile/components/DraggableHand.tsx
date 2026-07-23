import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PlayingCard } from "./PlayingCard";
import type { Card } from "../lib/types";

const CARD_WIDTH = 56;
const CARD_GAP = 8;
const SLOT_WIDTH = CARD_WIDTH + CARD_GAP;

/**
 * Mano de cartas reordenable por arrastre horizontal. El orden es
 * puramente de presentación (no afecta ninguna regla) y se persiste en
 * AsyncStorage por partida+jugador para sobrevivir a recargas.
 */
export function DraggableHand({
  cards,
  selected,
  onToggle,
  storageKey,
}: {
  cards: Card[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  storageKey: string;
}) {
  const [order, setOrder] = useState<string[]>(() => cards.map((c) => c.id));
  const [dragId, setDragId] = useState<string | null>(null);
  const dragX = useRef(new Animated.Value(0)).current;
  const dragStartIndexRef = useRef(0);
  const orderRef = useRef(order);
  orderRef.current = order;
  const loadedKeyRef = useRef<string | null>(null);

  // Carga el orden guardado la primera vez que tenemos cartas para esta clave.
  useEffect(() => {
    if (loadedKeyRef.current === storageKey) return;
    loadedKeyRef.current = storageKey;
    AsyncStorage.getItem(storageKey).then((raw) => {
      if (!raw) return;
      try {
        const saved: string[] = JSON.parse(raw);
        const ids = cards.map((c) => c.id);
        const idSet = new Set(ids);
        const kept = saved.filter((id) => idSet.has(id));
        const added = ids.filter((id) => !kept.includes(id));
        setOrder([...kept, ...added]);
      } catch {
        // ignora orden guardado corrupto
      }
    });
  }, [storageKey, cards]);

  // Mantiene `order` sincronizado cuando cambian las cartas (robo/descarte/etc.).
  useEffect(() => {
    setOrder((prev) => {
      const ids = cards.map((c) => c.id);
      const idSet = new Set(ids);
      const kept = prev.filter((id) => idSet.has(id));
      const added = ids.filter((id) => !kept.includes(id));
      const next = [...kept, ...added];
      const unchanged = next.length === prev.length && next.every((id, i) => id === prev[i]);
      return unchanged ? prev : next;
    });
  }, [cards]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  function persist(nextOrder: string[]) {
    AsyncStorage.setItem(storageKey, JSON.stringify(nextOrder)).catch(() => {});
  }

  // El padre reclama el toque desde el inicio (necesario para que esto
  // funcione de forma confiable en react-native-web) y decide él mismo si
  // terminó siendo un tap (selección) o un arrastre (reordenar), en vez de
  // depender de que el hijo ceda el responder tras cierto movimiento.
  function makeResponder(id: string) {
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved = false;
        dragStartIndexRef.current = orderRef.current.indexOf(id);
        dragX.setValue(0);
        setDragId(id);
      },
      onPanResponderMove: (_, g) => {
        if (!moved && Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6) return;
        moved = true;
        dragX.setValue(g.dx);
        const shift = Math.round(g.dx / SLOT_WIDTH);
        const from = dragStartIndexRef.current;
        const to = Math.max(0, Math.min(orderRef.current.length - 1, from + shift));
        const current = orderRef.current.indexOf(id);
        if (to !== current) {
          const next = [...orderRef.current];
          next.splice(current, 1);
          next.splice(to, 0, id);
          setOrder(next);
        }
      },
      onPanResponderRelease: () => {
        setDragId(null);
        dragX.setValue(0);
        if (moved) {
          persist(orderRef.current);
        } else {
          onToggle(id);
        }
      },
      onPanResponderTerminate: () => {
        setDragId(null);
        dragX.setValue(0);
      },
    });
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const responders = useMemo(() => new Map(order.map((id) => [id, makeResponder(id)])), [order.join(",")]);

  // Alternativa segura al arrastre: mover la carta seleccionada un lugar
  // a la vez con botones. Útil en dispositivos/entornos donde el gesto
  // de arrastre no se sienta bien.
  const selectedId = selected.size === 1 ? [...selected][0]! : null;
  const selectedIndex = selectedId ? order.indexOf(selectedId) : -1;

  function nudge(direction: -1 | 1) {
    if (selectedIndex < 0) return;
    const target = selectedIndex + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[selectedIndex], next[target]] = [next[target]!, next[selectedIndex]!];
    setOrder(next);
    persist(next);
  }

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.hand}>
        {order.map((id) => {
          const card = byId.get(id);
          if (!card) return null;
          const responder = responders.get(id);
          const isDragging = dragId === id;
          return (
            <Animated.View
              key={id}
              {...(responder?.panHandlers ?? {})}
              style={isDragging ? { transform: [{ translateX: dragX }], zIndex: 10, elevation: 10 } : undefined}
            >
              <PlayingCard card={card} selected={selected.has(id)} />
            </Animated.View>
          );
        })}
      </View>
      {selectedId ? (
        <View style={styles.nudgeRow}>
          <Pressable
            style={[styles.nudgeButton, selectedIndex <= 0 && styles.nudgeDisabled]}
            disabled={selectedIndex <= 0}
            onPress={() => nudge(-1)}
          >
            <Text style={styles.nudgeText}>◀ Mover</Text>
          </Pressable>
          <Pressable
            style={[styles.nudgeButton, selectedIndex >= order.length - 1 && styles.nudgeDisabled]}
            disabled={selectedIndex >= order.length - 1}
            onPress={() => nudge(1)}
          >
            <Text style={styles.nudgeText}>Mover ▶</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hand: { flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP, justifyContent: "center" },
  nudgeRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  nudgeButton: { backgroundColor: "#2c6b4f", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  nudgeDisabled: { opacity: 0.35 },
  nudgeText: { color: "#fff", fontWeight: "600", fontSize: 13 },
});
