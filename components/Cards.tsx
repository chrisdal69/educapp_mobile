import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useState, useRef, useEffect } from "react";
import type { ScrollView as ScrollViewType } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildCardBgUrl } from "@/utils/gcsPaths";
import type { Card, ClasseRepertoire } from "@/types/cards";

type Props = {
  cards: Card[];
  repertoires: ClasseRepertoire[];
  selectedRepertoire: string | null;
  selectedCard: Card | null;
  onSelect: (card: Card) => void;
};

export default function Cards({ cards, repertoires, selectedRepertoire, selectedCard, onSelect }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const cardWidth = width * 0.55;
  const [containerHeight, setContainerHeight] = useState(0);
  const [failedMobile, setFailedMobile] = useState<Set<string>>(new Set());
  const scrollRef = useRef<ScrollViewType>(null);

  useEffect(() => {
    if (!selectedCard || filtered.length === 0) return;
    const index = filtered.findIndex((c) => c._id === selectedCard._id);
    if (index === -1) return;
    if (index === filtered.length - 1) {
      scrollRef.current?.scrollToEnd({ animated: true });
    } else {
      const x = index * (cardWidth + 10) + 2;
      scrollRef.current?.scrollTo({ x, animated: true });
    }
  }, [selectedCard?._id]);

  const repOrder = repertoires.reduce<Record<string, number>>(
    (acc, r, i) => ({ ...acc, [r.repertoire]: i }),
    {}
  );

  const slug = (s: string) =>
    s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const filtered = selectedRepertoire
    ? cards
        .filter((c) => slug(c.repertoire) === slug(selectedRepertoire) && c.visible !== false)
        .sort((a, b) => b.order - a.order)
    : [...cards]
        .filter((c) => c.visible !== false)
        .sort((a, b) => {
          const rDiff = (repOrder[a.repertoire] ?? 0) - (repOrder[b.repertoire] ?? 0);
          return rDiff !== 0 ? rDiff : b.order - a.order;
        });

  return (
    <View
      style={[styles.container, { backgroundColor: colors.bg }]}
      onLayout={(e) => setContainerHeight(e.nativeEvent.layout.height)}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToOffsets={filtered.map((_, i) => i * (cardWidth + 10) + 2)}
        decelerationRate="fast"
      >
        {filtered.map((card) => {
          const isSelected = selectedCard?._id === card._id;
          const useMobile = !failedMobile.has(card._id);
          const bgUri =
            card.bg && user?.directoryname
              ? buildCardBgUrl({
                  directoryname: user.directoryname,
                  repertoire: card.repertoire,
                  num: card.num,
                  bg: card.bg,
                  mobile: useMobile,
                })
              : undefined;
          return (
            <TouchableOpacity
              key={card._id}
              onPress={() => onSelect(card)}
              activeOpacity={0.85}
              style={[
                styles.card,
                { width: cardWidth, height: containerHeight },
                isSelected && { ...styles.cardSelected, shadowColor: colors.text },
              ]}
            >
              <View style={styles.cardInner}>
                <ImageBackground
                  source={bgUri ? { uri: bgUri } : undefined}
                  style={styles.image}
                  imageStyle={styles.imageStyle}
                  onError={() =>
                    useMobile &&
                    setFailedMobile((prev) => new Set([...prev, card._id]))
                  }
                >
                  {!bgUri && <View style={[styles.imageFallback, { backgroundColor: colors.cardBg }]} />}
                  <View style={styles.overlay}>
                    <Text style={styles.repertoire} numberOfLines={1}>
                      {card.repertoire.toUpperCase()}
                    </Text>
                    <Text style={styles.titre} numberOfLines={2}>
                      {card.titre}
                    </Text>
                  </View>
                </ImageBackground>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 2,
    width: "100%",
  },
  scroll: {
    paddingHorizontal: 12,
    gap: 10,
    alignItems: "flex-start",
  },
  card: {
    borderRadius: 12,
  },
  cardSelected: {
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 18,
  },
  cardInner: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  image: {
    flex: 1,
    justifyContent: "flex-end",
  },
  imageStyle: {
    borderRadius: 10,
  },
  imageFallback: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    backgroundColor: "rgba(0,0,0,0.35)",
    padding: 10,
  },
  repertoire: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 2,
  },
  titre: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
