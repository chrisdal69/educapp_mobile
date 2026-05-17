import { View, StyleSheet } from "react-native";
import AppText from "@/components/AppText";
import type { Card } from "@/types/cards";

type Props = { card: Card; onClose: () => void };

export default function FilesBlock({ card, onClose }: Props) {
  return (
    <View style={styles.container}>
      <AppText>FilesBlock</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
