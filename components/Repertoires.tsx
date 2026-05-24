import { View, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import type { ClasseRepertoire } from "@/types/cards";

type Props = {
  repertoires: ClasseRepertoire[];
  selected: string | null;
  onSelect: (slug: string) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
};

export default function Repertoires({ repertoires, selected, onSelect, onRefresh, refreshing }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        style={styles.scrollView}
      >
        {repertoires.map((r) => {
          const isSelected = r.repertoire === selected;
          return (
            <TouchableOpacity
              key={r.repertoire}
              onPress={() => onSelect(r.repertoire)}
              style={styles.item}
            >
              <AppText style={[styles.label, { color: isSelected ? colors.text : colors.muted }]}>
                {r.repertoire}
              </AppText>
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
      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} disabled={refreshing} style={styles.refreshBtn}>
          {refreshing
            ? <ActivityIndicator size="small" color={colors.muted as string} />
            : <Ionicons name="refresh-outline" size={20} color={colors.muted as string} />
          }
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  scrollView: {
    flex: 1,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexShrink: 0,
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
