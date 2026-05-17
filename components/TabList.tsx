import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import type { ComponentProps } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Card, CardHref } from "@/types/cards";
import type { ThemeColors } from "@/theme";
import ContentBlock from "@/components/card/ContentBlock";
import FilesBlock from "@/components/card/FilesBlock";
import QuizzBlock from "@/components/card/QuizzBlock";
import FlashBlock from "@/components/card/FlashBlock";
import VideoBlock from "@/components/card/VideoBlock";
import CloudBlock from "@/components/card/CloudBlock";

type IoniconName = ComponentProps<typeof Ionicons>["name"];
type ZoneKey =
  | "description"
  | "documents"
  | "quizz"
  | "flash"
  | "video"
  | "cloud";

type Zone = {
  key: ZoneKey;
  label: string;
  icon: IoniconName;
  colorKey: keyof ThemeColors;
  subtitle: string;
};

type Props = {
  selectedCard: Card | null;
};

const getFilesSubtitle = (fichiers: CardHref[]): string => {
  if (!fichiers.length) return "Aucun fichier";
  const extCounts: Record<string, number> = {};
  fichiers.forEach((f) => {
    const ext = f.href.split(".").pop()?.toLowerCase() ?? "fichier";
    extCounts[ext] = (extCounts[ext] ?? 0) + 1;
  });
  return Object.entries(extCounts)
    .map(([ext, count]) => `${count} ${ext}`)
    .join(" · ");
};

export default function TabList({ selectedCard }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeZone, setActiveZone] = useState<ZoneKey | null>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const { width: screenWidth } = useWindowDimensions();

  const PADDING = 10;
  const GAP = 15;
  const rowHeight = containerHeight > 0 ? containerHeight / 3 - GAP -3: 120;
  const tileHalfWidth = (screenWidth - PADDING * 2 - GAP) / 2;

  if (!selectedCard) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.bg }]}
        onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
      >
        <Text style={{ color: colors.muted }}>Sélectionnez une carte</Text>
      </View>
    );
  }

  const zones: Zone[] = [
    {
      key: "description",
      label: "Description",
      icon: "reader-outline",
      colorKey: "description",
      subtitle: "Résumé du chapitre",
    },
    {
      key: "documents",
      label: "Documents",
      icon: "document-text-outline",
      colorKey: "documents",
      subtitle: getFilesSubtitle(selectedCard.fichiers ?? []),
    },
    ...((selectedCard.quizz ?? []).length > 0
      ? [
          {
            key: "quizz" as ZoneKey,
            label: "Quizz",
            icon: "help-circle-outline" as IoniconName,
            colorKey: "quizz" as keyof ThemeColors,
            subtitle: `${selectedCard.quizz.length} questions`,
          },
        ]
      : []),
    {
      key: "flash" as ZoneKey,
      label: "FlashCards",
      icon: "albums-outline" as IoniconName,
      colorKey: "flash" as keyof ThemeColors,
      subtitle: `${(selectedCard.flash ?? []).length} cartes`,
    },
    ...((selectedCard.video ?? []).length > 0
      ? [
          {
            key: "video" as ZoneKey,
            label: "Vidéos",
            icon: "play-circle-outline" as IoniconName,
            colorKey: "video" as keyof ThemeColors,
            subtitle: `${selectedCard.video.length} vidéos`,
          },
        ]
      : []),
    ...(selectedCard.cloud !== false
      ? [
          {
            key: "cloud" as ZoneKey,
            label: "Cloud",
            icon: "cloud-outline" as IoniconName,
            colorKey: "cloud" as keyof ThemeColors,
            subtitle: "",
          },
        ]
      : []),
  ];

  const [descZone, ...rest] = zones;
  const hasL4 = rest.length === 5;
  const gridZones = hasL4 ? rest.slice(0, 4) : rest;
  const l4Zone = hasL4 ? rest[4] : null;

  const gridRows: Zone[][] = [];
  for (let i = 0; i < gridZones.length; i += 2) {
    gridRows.push(gridZones.slice(i, i + 2));
  }

  const activeZoneData = zones.find((z) => z.key === activeZone);
  const modalSubtitle = `${user?.publicname ?? ""} - ${selectedCard.titre}`;

  const zoneBgColorKey: Record<ZoneKey, keyof ThemeColors> = {
    description: "bgdescription",
    documents: "bgdocuments",
    quizz: "bgquizz",
    flash: "bgflash",
    video: "bgvideo",
    cloud: "bgcloud",
  };
  const modalBg = activeZone ? colors[zoneBgColorKey[activeZone]] as string : colors.bg;

  const renderTile = (zone: Zone, fullWidth = false) => (
    <TouchableOpacity
      key={zone.key}
      activeOpacity={0.8}
      style={[
        styles.tile,
        fullWidth ? styles.tileFull : { width: tileHalfWidth },
        { backgroundColor: colors[zone.colorKey] as string },
      ]}
      onPress={() => setActiveZone(zone.key)}
    >
      {zone.key === "description" ? (
        <View style={styles.descRow}>
          <View style={styles.descLeft}>
            <Ionicons
              name={zone.icon}
              size={40}
              style={[styles.tileIcon, { color: colors.textSecondary }]}
            />
            <View>
              <Text style={[styles.tileLabel, { color: colors.text }]}>
                {zone.label}
              </Text>
              {!!zone.subtitle && (
                <Text
                  style={[styles.tileSubtitle, { color: colors.textSecondary }]}
                >
                  {zone.subtitle}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.descRight}>
            <Text
              style={[styles.descCardTitle, { color: colors.text }]}
              numberOfLines={3}
            >
              {selectedCard.titre}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <Ionicons
            name={zone.icon}
            size={40}
            style={[styles.tileIcon, { color: colors.textSecondary }]}
          />
          <Text style={[styles.tileLabel, { color: colors.text }]}>
            {zone.label}
          </Text>
          {!!zone.subtitle && (
            <Text
              style={[styles.tileSubtitle, { color: colors.textSecondary }]}
            >
              {zone.subtitle}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <View
      style={[styles.container, { backgroundColor: colors.bg }]}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* L1 — Description pleine largeur */}
        <View style={[styles.row, { height: rowHeight }]}>
          {renderTile(descZone, true)}
        </View>

        {/* L2 + L3 — grille 2 colonnes */}
        {gridRows.map((row, i) => (
          <View key={i} style={[styles.row, { height: rowHeight }]}>
            {row.map((zone) => renderTile(zone))}
          </View>
        ))}

        {/* L4 — Cloud pleine largeur (si 6 zones), sous le viewport */}
        {l4Zone && (
          <View style={[styles.row, { height: rowHeight }]}>
            {renderTile(l4Zone, true)}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!activeZone}
        animationType="slide"
        transparent
        onRequestClose={() => setActiveZone(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { backgroundColor: modalBg }]}>
            <View
              style={[
                styles.modalHeader,
                {
                  backgroundColor: activeZoneData
                    ? (colors[activeZoneData.colorKey] as string)
                    : colors.bg,
                },
              ]}
            >
              <View style={styles.modalHeaderText}>
                <Text style={[styles.modalTitle , { color: colors.text }]}>{activeZoneData?.label}</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>{modalSubtitle}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setActiveZone(null)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={30} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalContent}>
              {activeZone === "description" && (
                <ContentBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
              {activeZone === "documents" && (
                <FilesBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
              {activeZone === "quizz" && (
                <QuizzBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
              {activeZone === "flash" && (
                <FlashBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
              {activeZone === "video" && (
                <VideoBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
              {activeZone === "cloud" && (
                <CloudBlock
                  card={selectedCard}
                  onClose={() => setActiveZone(null)}
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 6,
    width: "100%",
    paddingTop:8,
  },
  scrollContent: {
    padding: 10,
    gap: 15,
  },
  row: {
    flexDirection: "row",
    gap: 15,
  },
  tile: {
    borderRadius: 14,
    padding: 16,
    minHeight: 100,
    justifyContent: "flex-end",
  },
  descRow: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  descLeft: {
    flexDirection: "column",
  },
 descRight: {
  flex:1,
  height: "100%",
  justifyContent: "center",

},
  descCardTitle: {
    fontSize: 30,
    fontWeight: "200",
    fontStyle: "italic",
    textAlign: "right",
    
  },
  tileFull: {
    flex: 1,
  },
  tileHalf: {
    flex: 1,
  },
  tileIcon: {
    marginBottom: 28,
  },
  tileLabel: {
    fontSize: 22,
    fontWeight: "700",
  },
  tileSubtitle: {
    fontSize: 14,
    marginTop: 5,
  },
  overlay: {
    flex: 1,
  },
  sheet: {
    flex: 1,
    marginTop: Platform.OS === "android" ? "1%" : "13%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
    paddingTop: 24,
  },
  modalHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "700",
  },
  modalSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  closeBtn: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
  },
});
