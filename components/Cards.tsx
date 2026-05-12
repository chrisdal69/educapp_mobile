import { View, StyleSheet, Text } from "react-native";
import type { Card } from "@/types/cards";

type Props = {
  cards: Card[];
  selectedRepertoire: string | null;
  selectedCard: Card | null;
  onSelect: (card: Card) => void;
};

export default function Cards({ cards, selectedRepertoire, selectedCard, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text>Cards</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});
