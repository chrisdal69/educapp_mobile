import { View, Text, StyleSheet } from "react-native";
import type { Card } from "@/types/cards";

type Props = {
  selectedCard: Card | null;
};

export default function TabList({ selectedCard }: Props) {
  return (
    <View style={styles.container}>
      <Text>TabList</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 6,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});
