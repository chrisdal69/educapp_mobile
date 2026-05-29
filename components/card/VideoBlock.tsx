import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import type { Card } from "@/types/cards";

type Props = { card: Card; onClose: () => void };

// ── YouTube helpers ───────────────────────────────────────────────────────────

function extractVideoId(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (host.includes("youtube.com")) {
      if (u.pathname.includes("/embed/"))
        return u.pathname.split("/embed/")[1]?.split("/")[0] ?? "";
      return u.searchParams.get("v") ?? "";
    }
  } catch {}
  return "";
}

// ── Constants ────────────────────────────────────────────────────────────────

const BAR_GAP = 6;
const BAR_H = 6;
const BAR_W = 28;
const PLAYLIST_ITEM_H = 80;

// ── Component ────────────────────────────────────────────────────────────────

export default function VideoBlock({ card }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();

  const videos = (card.video ?? []).filter((v) => v.href?.trim());
  const [current, setCurrent] = useState(0);
  const [pendingIdx, setPendingIdx] = useState<number | null>(null);
  // pendingCommit : déclenche le useEffect de finalisation après le re-render React
  const [pendingCommit, setPendingCommit] = useState<number | null>(null);
  const currentRef = useRef(0);
  const swipeDirRef = useRef<"left" | "right" | null>(null);
  const playlistScrollRef = useRef<ScrollView>(null);
  const playlistViewHeightRef = useRef(0);

  const videoHeight = Math.round((width * 9) / 16 - 18);

  const translateX = useRef(new Animated.Value(0)).current;
  const pendingBase = useRef(new Animated.Value(width)).current;
  const pendingTranslateX = useRef(Animated.add(pendingBase, translateX)).current;

  // ── Finalisation d'une transition ──────────────────────────────────────────
  // Séquence critique (évite le flash) :
  // 1. setCurrent(newIdx) → React re-render : nouvelle vidéo dans la carte courante
  //    (toujours à translateX=-width, off-screen) + carte pendante encore visible à 0
  // 2. useEffect : translateX → 0 (la carte courante avec la nouvelle vidéo arrive à 0,
  //    la carte pendante repart à pendingBase ± width donc hors écran)
  // 3. setPendingIdx(null) + setPendingCommit(null) → cleanup invisible
  useEffect(() => {
    if (pendingCommit === null) return;
    translateX.setValue(0);
    setPendingIdx(null);
    swipeDirRef.current = null;
    setPendingCommit(null);
  }, [pendingCommit]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const itemH = PLAYLIST_ITEM_H + 20;
    const y = current * itemH - playlistViewHeightRef.current / 2 + itemH / 2;
    playlistScrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, [current]);

  const clearPending = useCallback(() => {
    setPendingIdx(null);
    swipeDirRef.current = null;
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= videos.length) return;
      translateX.stopAnimation();
      translateX.setValue(0);
      clearPending();
      currentRef.current = idx;
      setCurrent(idx);
    },
    [videos.length, translateX, clearPending]
  );

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onUpdate((e) => {
      const dx = e.translationX;

      // Détection de direction au premier mouvement significatif
      if (swipeDirRef.current === null && Math.abs(dx) > 5) {
        if (dx < 0 && currentRef.current < videos.length - 1) {
          swipeDirRef.current = "left";
          pendingBase.setValue(width);           // prochaine carte arrive de droite
          setPendingIdx(currentRef.current + 1);
        } else if (dx > 0 && currentRef.current > 0) {
          swipeDirRef.current = "right";
          pendingBase.setValue(-width);          // carte précédente arrive de gauche
          setPendingIdx(currentRef.current - 1);
        }
      }

      // Effet caoutchouc aux extrémités
      const atStart = currentRef.current === 0;
      const atEnd = currentRef.current === videos.length - 1;
      if ((dx > 0 && atStart) || (dx < 0 && atEnd)) {
        translateX.setValue(dx * 0.2);
      } else {
        translateX.setValue(dx);
      }
    })
    .onEnd((e) => {
      const halfWidth = width / 2;

      if (e.translationX < -halfWidth && currentRef.current < videos.length - 1) {
        const nextIdx = currentRef.current + 1;
        Animated.timing(translateX, {
          toValue: -width,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            currentRef.current = nextIdx;
            // setCurrent + setPendingCommit batchés → un seul re-render
            // puis useEffect remet translateX à 0 après ce render
            setCurrent(nextIdx);
            setPendingCommit(nextIdx);
          }
        });
      } else if (e.translationX > halfWidth && currentRef.current > 0) {
        const prevIdx = currentRef.current - 1;
        Animated.timing(translateX, {
          toValue: width,
          duration: 180,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            currentRef.current = prevIdx;
            setCurrent(prevIdx);
            setPendingCommit(prevIdx);
          }
        });
      } else {
        // Pas assez → retour élastique (pending déjà off-screen quand translateX=0)
        Animated.spring(translateX, {
          toValue: 0,
          damping: 20,
          stiffness: 200,
          useNativeDriver: true,
        }).start(() => clearPending());
      }
    });

  if (!videos.length) {
    return (
      <View style={[styles.container, { backgroundColor: colors.bgvideo as string }]}>
        <AppText style={{ color: colors.text as string, textAlign: "center", marginTop: 40 }}>
          Aucune vidéo disponible.
        </AppText>
      </View>
    );
  }

  // ── Contenu d'une carte vidéo ──────────────────────────────────────────────
  const renderCard = (idx: number) => {
    const slide = videos[idx];
    const videoId = extractVideoId(slide.href);
    const hasDuration = slide.duration != null;
    return (
      <>
        <View style={styles.videoInfo}>
          <AppText style={[styles.videoLabel, { color: colors.text as string }]}>
            {`Vidéo ${idx + 1}/${videos.length}`}
            {hasDuration ? ` - ${slide.duration} mn` : ""}
          </AppText>
          {!!slide.txt && (
            <AppText style={[styles.videoTitle, { color: colors.text as string }]}>
              {slide.txt}
            </AppText>
          )}

        </View>
        {videoId ? (
          <YoutubePlayer
            key={`yt-${idx}`}
            height={videoHeight}
            videoId={videoId}
            play={false}
            webViewStyle={{ opacity: 0.99 }}
            initialPlayerParams={{ rel: 0, controls: 1 }}
          />
        ) : (
          <View style={[styles.noVideo, { height: videoHeight }]}>
            <AppText style={{ color: colors.textSecondary as string }}>
              URL vidéo invalide
            </AppText>
          </View>
        )}
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgvideo as string }]}>

      {/* ── Barre de progression ── */}
      <View style={{ height: BAR_H + 30, margin: "auto" }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.barsContent, { gap: BAR_GAP }]}
          style={styles.barsScroll}
        >
          {videos.map((_, idx) => (
            <TouchableOpacity
              key={idx}
              onPress={() => goTo(idx)}
              hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
            >
              <View
                style={[
                  styles.bar,
                  {
                    backgroundColor:
                      idx === current
                        ? (colors.boutonyes as string)
                        : (colors.video as string),
                    borderWidth: idx === current ? 1.5 : 0,
                    borderColor: colors.text as string,
                  },
                ]}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Carrousel (2 cartes animées en parallèle) ── */}
      <GestureDetector gesture={swipeGesture}>
        <View style={[styles.carouselContainer]}>

          {/* Carte pendante (vidéo suivante ou précédente) */}
          {pendingIdx !== null && (
            <Animated.View
              style={[
                styles.videoCard,
                styles.pendingCard,
                { backgroundColor: colors.video as string },
                { transform: [{ translateX: pendingTranslateX }] },
              ]}
            >
              {renderCard(pendingIdx)}
            </Animated.View>
          )}

          {/* Carte courante */}
          <Animated.View
            style={[
              styles.videoCard,
              { backgroundColor: colors.video as string },
              { transform: [{ translateX }] },
            ]}
          >
            {renderCard(current)}
          </Animated.View>

        </View>
      </GestureDetector>

      {/* ── En-tête playlist ── */}
      <View
        style={[styles.playlistHeader, { borderBottomColor: colors.textSecondary as string }]}
      >
        <AppText style={[styles.playlistTitle, { color: colors.text as string }]}>
          {`PLAYLIST - ${videos.length} vidéo${videos.length > 1 ? "s" : ""}`}
        </AppText>
      </View>

      {/* ── Liste playlist ── */}
      <ScrollView
        ref={playlistScrollRef}
        onLayout={(e) => { playlistViewHeightRef.current = e.nativeEvent.layout.height; }}
        style={styles.playlistScroll}
        showsVerticalScrollIndicator={false}
      >
        {videos.map((v, idx) => {
          const isSelected = idx === current;
          const isOddNumber = (idx + 1) % 2 !== 0;
          const itemBg = isOddNumber
            ? (colors.video as string) + "80"
            : (colors.video as string);

          return (
            <TouchableOpacity key={idx} onPress={() => goTo(idx)} activeOpacity={0.7}>
              <View
                style={[
                  styles.playlistItem,
                  { backgroundColor: itemBg },
                  isSelected && {
                    borderWidth: 2,
                    borderColor: colors.text as string,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 5,
                    elevation: 5,
                  },
                ]}
              >
                <AppText style={[styles.playlistNum, { color: colors.text as string }]}>
                  {idx + 1}
                </AppText>

                <View style={styles.ytIconWrap}>
                  <View style={styles.ytIconBox}>
                    <AppText style={styles.ytPlay}>▶</AppText>
                  </View>
                  <AppText style={[styles.ytLabel, { color: colors.text as string }]}>
                    YouTube
                  </AppText>
                </View>

                <View style={styles.playlistText}>
                  <AppText
                    numberOfLines={2}
                    style={[styles.playlistItemTitle, { color: colors.text as string }]}
                  >
                    {v.txt || "Vidéo sans titre"}
                  </AppText>
                  {!!v.hover && (
                    <AppText
                      numberOfLines={2}
                      style={[styles.playlistDuration, { color: colors.textSecondary as string }]}
                    >
                      {v.hover}
                    </AppText>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  barsScroll: {  marginTop: 16 },
  barsContent: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 4,
    height: BAR_H + 8,
  },

  bar: { width: BAR_W, height: BAR_H, borderRadius: 5 },

  carouselContainer: {
    overflow: "hidden",
    marginTop: 16,
    marginHorizontal: 16,
    borderWidth: 1,
  },

  videoCard: {
    overflow: "hidden",
    backgroundColor: "transparent",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },

  pendingCard: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  videoInfo: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  videoLabel: { fontSize: 15, fontWeight: "700" },
  videoTitle: { fontSize: 13, marginTop: 3 },
  videoHover: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  noVideo: { alignItems: "center", justifyContent: "center" },

  playlistHeader: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    marginHorizontal: 16,

  },
  playlistTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5 },

  playlistScroll: { flex: 1},
  playlistItem: {
    height: PLAYLIST_ITEM_H,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 18,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  playlistNum: { width: 22, fontSize: 13, fontWeight: "600", textAlign: "center" },

  ytIconWrap: { alignItems: "center", gap: 2 },
  ytIconBox: {
    width: 44,
    height: 30,
    backgroundColor: "#FF0000",
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  ytPlay: { color: "#fff", fontSize: 13 },
  ytLabel: { fontSize: 9, fontWeight: "600" },

  playlistText: { flex: 1 },
  playlistItemTitle: { fontSize: 13, lineHeight: 18 },
  playlistDuration: { fontSize: 11, marginTop: 2 },
});
