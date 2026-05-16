import { View, Text, StyleSheet } from "react-native";
import type { Card } from "@/types/cards";

type Props = { card: Card; onClose: () => void };

export default function VideoBlock({ card, onClose }: Props) {
  return (
    <View style={styles.container}>
      <Text>VideoBlock</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
