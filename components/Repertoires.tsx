import { View, StyleSheet, Text } from "react-native";
import type { ClasseRepertoire } from "@/types/cards";

type Props = {
  repertoires: ClasseRepertoire[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

export default function Repertoires({ repertoires, selected, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <Text>Repertoires</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "black",
    width: "100%",
  },
});
