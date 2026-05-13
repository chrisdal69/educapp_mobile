import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import type { ClasseRepertoire } from "@/types/cards";

type Props = {
  repertoires: ClasseRepertoire[];
  selected: string | null;
  onSelect: (slug: string) => void;
};

export default function Repertoires({ repertoires, selected, onSelect }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {repertoires.map((r) => {
          const isSelected = r.repertoire === selected;
          return (
            <TouchableOpacity
              key={r.repertoire}
              onPress={() => onSelect(r.repertoire)}
              style={styles.item}
            >
              <Text style={[styles.label, { color: isSelected ? colors.text : colors.muted }]}>
                {r.repertoire}
              </Text>
              <View
                style={[
                  styles.underline,
                  { backgroundColor: isSelected ? r.primary : "transparent" },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-start",
  },
  scroll: {
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 20,
  },
  item: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignItems: "center",
  },
  label: {
    fontSize: 30,
    fontWeight: "500",
  },
  underline: {
    marginTop: 3,
    height: 2,
    width: "100%",
    borderRadius: 1,
  },
});
