import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Card } from "../lib/types";
import { cardAccessibilityLabel, isRedSuit, suitSymbol } from "../lib/cardDisplay";

export function PlayingCard({
  card,
  selected,
  small,
  onPress,
}: {
  card: Card;
  selected?: boolean;
  small?: boolean;
  onPress?: () => void;
}) {
  const isJoker = card.rank === "JOKER";
  const red = isRedSuit(card.suit);

  const content = (
    <View
      style={[
        styles.card,
        small && styles.cardSmall,
        selected && styles.cardSelected,
        isJoker && styles.cardJoker,
      ]}
      accessible
      accessibilityLabel={cardAccessibilityLabel(card) + (selected ? ", seleccionada" : "")}
    >
      <Text style={[styles.rank, small && styles.rankSmall, { color: isJoker ? "#7b3fbf" : red ? "#c0392b" : "#1c1c1c" }]}>
        {isJoker ? "★" : card.rank}
      </Text>
      {!isJoker ? (
        <Text style={[styles.suit, small && styles.suitSmall, { color: red ? "#c0392b" : "#1c1c1c" }]}>
          {suitSymbol(card.suit)}
        </Text>
      ) : null}
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cardAccessibilityLabel(card)}
      accessibilityState={{ selected: !!selected }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 56,
    height: 78,
    borderRadius: 8,
    backgroundColor: "#fdfdfa",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#00000022",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  cardSmall: { width: 40, height: 56, borderRadius: 6 },
  cardSelected: {
    borderColor: "#f5c542",
    borderWidth: 3,
    marginTop: -10,
    shadowColor: "#f5c542",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 8,
  },
  cardJoker: { backgroundColor: "#f4ecff" },
  rank: { fontSize: 20, fontWeight: "800" },
  rankSmall: { fontSize: 15 },
  suit: { fontSize: 18 },
  suitSmall: { fontSize: 13 },
});
