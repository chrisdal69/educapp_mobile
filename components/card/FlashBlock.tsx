import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import WebView from "react-native-webview";
import katex from "katex";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { storageGet, storageSet, storageDelete } from "@/utils/storage";
import { buildCardFlashImageUrl } from "@/utils/gcsPaths";
import type { Card, CardFlash } from "@/types/cards";

// ── Math rendering ────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderInlineMath(text: string): string {
  const result: string[] = [];
  const chars = Array.from(text);
  let buffer = "";
  let inMath = false;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (c === "\\" && chars[i + 1] === "$") {
      buffer += "$";
      i++;
      continue;
    }
    if (c === "$") {
      if (inMath) {
        if (buffer.length === 0) {
          result.push(escapeHtml("$$"));
        } else {
          try {
            result.push(
              katex.renderToString(buffer, { output: "mathml", throwOnError: false })
            );
          } catch {
            result.push(escapeHtml(`$${buffer}$`));
          }
        }
        buffer = "";
        inMath = false;
      } else {
        if (buffer.length > 0) result.push(escapeHtml(buffer));
        buffer = "";
        inMath = true;
      }
      continue;
    }
    buffer += c;
  }
  if (inMath) result.push(escapeHtml(`$${buffer}`));
  else if (buffer.length > 0) result.push(escapeHtml(buffer));
  return result.join("");
}

// ── Shuffle ───────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildFlashHtml(
  f: CardFlash,
  rectoImageUrl: string,
  versoImageUrl: string,
  bgColor: string,
  textColor: string
): string {
  const rectoText = renderInlineMath(f.question);
  const versoText = renderInlineMath(f.reponse);
  const rectoImg = rectoImageUrl
    ? `<div class="img-wrap"><img src="${rectoImageUrl}" /></div>`
    : "";
  const versoImg = versoImageUrl
    ? `<div class="img-wrap"><img src="${versoImageUrl}" /></div>`
    : "";
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${bgColor}}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
  line-height:1.75;
  padding:20px 16px 32px;
  color:${textColor};
  -webkit-tap-highlight-color:transparent;
}
.face{display:none}
.face.active{display:block}
.text{font-size:20px;line-height:1.6}
.img-wrap{text-align:center;margin-top:18px}
.img-wrap img{max-width:100%;max-height:280px;border-radius:10px;object-fit:contain}
math{font-size:1em}
</style></head>
<body>
<div id="face-recto" class="face active">
  <div class="text">${rectoText}</div>${rectoImg}
</div>
<div id="face-verso" class="face">
  <div class="text">${versoText}</div>${versoImg}
</div>
<script>
function flip(side){
  document.getElementById('face-recto').className='face'+(side==='recto'?' active':'');
  document.getElementById('face-verso').className='face'+(side==='verso'?' active':'');
  setTimeout(function(){
    var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'height',h:h}));
  },30);
}
window.addEventListener('load',function(){
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'load',h:h}));
});
</script>
</body></html>`;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const acquisStorageKey = (cardId: string) => `flash_acquis_${cardId}`;

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  card: Card;
  onClose: () => void;
  onCurrentChange?: (current: number, total: number) => void;
};

export default function FlashBlock({ card, onCurrentChange }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flash: CardFlash[] = useMemo(() => card.flash ?? [], [card._id]);

  const webviewRef = useRef<WebView>(null);
  const currentRef = useRef(0);
  const sideRef = useRef<"recto" | "verso">("recto");
  const acquisRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<CardFlash[]>([]);
  const deckPhaseRef = useRef<1 | 2>(1);

  const [deck, setDeck] = useState<CardFlash[]>([]);
  const [deckPhase, setDeckPhase] = useState<1 | 2>(1);
  const [current, setCurrent] = useState(0);
  const [side, setSide] = useState<"recto" | "verso">("recto");
  const [acquis, setAcquis] = useState<Set<string>>(new Set());
  const [cardHeight, setCardHeight] = useState(300);
  const [ready, setReady] = useState(false);

  currentRef.current = current;
  sideRef.current = side;
  acquisRef.current = acquis;
  deckRef.current = deck;
  deckPhaseRef.current = deckPhase;

  // Load acquis from storage then build initial deck
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let acquisSet = new Set<string>();
      if (card._id) {
        try {
          const raw = await storageGet(acquisStorageKey(card._id));
          if (raw) acquisSet = new Set<string>(JSON.parse(raw));
        } catch {}
      }
      if (!cancelled) {
        acquisRef.current = acquisSet;
        setAcquis(acquisSet);
        setDeck(shuffle(flash));
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card._id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Notify parent of progress
  useEffect(() => {
    if (deck.length > 0) onCurrentChange?.(current, deck.length);
  }, [current, deck.length, onCurrentChange]);

  // Persist acquis changes
  useEffect(() => {
    if (!ready || !card._id) return;
    storageSet(acquisStorageKey(card._id), JSON.stringify([...acquis]));
  }, [acquis, ready, card._id]);

  const injectCurrentSide = useCallback(() => {
    webviewRef.current?.injectJavaScript(`flip('${sideRef.current}');true;`);
  }, []);

  const goTo = useCallback(
    (idx: number) => {
      if (idx < 0) return;
      const d = deckRef.current;
      const phase = deckPhaseRef.current;
      if (idx >= d.length) {
        const nonAcquis = flash.filter((fi) => !acquisRef.current.has(fi.id));
        if (phase === 1 && nonAcquis.length > 0 && nonAcquis.length < flash.length) {
          setDeck(shuffle(nonAcquis));
          setDeckPhase(2);
        } else {
          setDeck(shuffle(flash));
          setDeckPhase(1);
        }
        setCurrent(0);
        setSide("recto");
        setCardHeight(300);
        return;
      }
      setCardHeight(300);
      setSide("recto");
      setCurrent(idx);
    },
    [flash]
  );

  const markAcquis = useCallback(() => {
    const f = deckRef.current[currentRef.current];
    if (!f) return;
    const next = new Set(acquisRef.current);
    next.add(f.id);
    acquisRef.current = next;
    setAcquis(next);
    goTo(currentRef.current + 1);
  }, [goTo]);

  const handleReset = useCallback(() => {
    acquisRef.current = new Set();
    setAcquis(new Set());
    if (card._id) storageDelete(acquisStorageKey(card._id));
    setDeck(shuffle(flash));
    setDeckPhase(1);
    setCurrent(0);
    setSide("recto");
    setCardHeight(300);
  }, [card._id, flash]);

  const flipTo = useCallback((newSide: "recto" | "verso") => {
    if (newSide === sideRef.current) return;
    sideRef.current = newSide;
    setSide(newSide);
    webviewRef.current?.injectJavaScript(`flip('${newSide}');true;`);
  }, []);

  const swipeGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-25, 25])
    .failOffsetY([-15, 15])
    .onEnd((event) => {
      if (event.translationX < -50) goTo(currentRef.current + 1);
      else if (event.translationX > 50) goTo(currentRef.current - 1);
    });

  // ── Progress bars ─────────────────────────────────────────────────────────

  const BAR_GAP = 6;
  const MAX_VISIBLE = 10;
  const RESET_WIDTH = 48;
  const availableWidth = screenWidth - 32 - RESET_WIDTH;
  const n = Math.max(1, Math.min(deck.length, MAX_VISIBLE));
  const barWidth = Math.max(20, (availableWidth - BAR_GAP * (n - 1)) / n);

  const getBarBg = useCallback(
    (fi: CardFlash): string =>
      acquis.has(fi.id) ? (colors.boutonyes as string) : (colors.muted as string),
    [acquis, colors]
  );

  // ── Current card data ─────────────────────────────────────────────────────

  const f = deck[current];

  const rectoImageUrl = useMemo(
    () =>
      f?.imquestion && user?.directoryname
        ? buildCardFlashImageUrl({
            directoryname: user.directoryname,
            repertoire: card.repertoire,
            num: card.num,
            filename: f.imquestion,
          })
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.id, f?.imquestion, user?.directoryname, card.repertoire, card.num]
  );

  const versoImageUrl = useMemo(
    () =>
      f?.imreponse && user?.directoryname
        ? buildCardFlashImageUrl({
            directoryname: user.directoryname,
            repertoire: card.repertoire,
            num: card.num,
            filename: f.imreponse,
          })
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.id, f?.imreponse, user?.directoryname, card.repertoire, card.num]
  );

  const cardHtml = useMemo(
    () =>
      f
        ? buildFlashHtml(
            f,
            rectoImageUrl,
            versoImageUrl,
            colors.bgflash as string,
            colors.text as string
          )
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.id, rectoImageUrl, versoImageUrl, colors.bgflash, colors.text]
  );

  const nonAcquisCount = useMemo(
    () => flash.filter((fi) => !acquis.has(fi.id)).length,
    [flash, acquis]
  );

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!ready) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary as string} />
      </View>
    );
  }

  if (flash.length === 0) {
    return (
      <View style={styles.centered}>
        <AppText style={{ color: colors.muted as string }}>
          Aucune flashcard disponible.
        </AppText>
      </View>
    );
  }

  const bgFlash = colors.bgflash as string;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, { backgroundColor: bgFlash }]}>

      {/* Progress bars */}
      <View style={styles.progressRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.barsContent, { gap: BAR_GAP }]}
          style={styles.barsScroll}
        >
          {deck.map((fi, idx) => (
            <TouchableOpacity
              key={fi.id}
              onPress={() => {
                setCardHeight(300);
                setSide("recto");
                setCurrent(idx);
              }}
              style={[
                styles.bar,
                {
                  width: barWidth,
                  backgroundColor: getBarBg(fi),
                  borderWidth: idx === current ? 1.5 : 0,
                  borderColor: colors.text as string,
                },
              ]}
            />
          ))}
        </ScrollView>
        <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
          <Ionicons name="refresh-outline" size={22} color={colors.textSecondary as string} />
        </TouchableOpacity>
      </View>

      {/* Non-acquis counter */}
      <AppText style={[styles.toReviewText, { color: colors.textSecondary as string }]}>
        {nonAcquisCount > 0 ? `${nonAcquisCount} à revoir` : "Tout acquis !"}
      </AppText>

      {/* Recto / Verso toggle */}
      <View style={styles.faceBtns}>
        <TouchableOpacity
          style={[
            styles.faceBtn,
            side === "recto" && { backgroundColor: colors.flash as string },
          ]}
          onPress={() => flipTo("recto")}
        >
          <AppText
            style={[
              styles.faceBtnText,
              { color: side === "recto" ? (colors.text as string) : (colors.muted as string) },
            ]}
          >
            Recto
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.faceBtn,
            side === "verso" && { backgroundColor: colors.flash as string },
          ]}
          onPress={() => flipTo("verso")}
        >
          <AppText
            style={[
              styles.faceBtnText,
              { color: side === "verso" ? (colors.text as string) : (colors.muted as string) },
            ]}
          >
            Verso
          </AppText>
        </TouchableOpacity>
      </View>

      {/* Card content */}
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          style={[styles.cardScroll, { backgroundColor: bgFlash }]}
          contentContainerStyle={{ minHeight: cardHeight }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{ height: cardHeight, backgroundColor: bgFlash }}>
            <WebView
              ref={webviewRef}
              key={f?.id ?? "empty"}
              source={{ html: cardHtml }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, backgroundColor: "transparent" }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.t === "load") {
                    if (data.h > 0) setCardHeight(data.h + 24);
                    injectCurrentSide();
                  } else if (data.t === "height") {
                    if (data.h > 0) setCardHeight(data.h + 24);
                  }
                } catch {}
              }}
            />
          </View>
        </ScrollView>
      </GestureDetector>

      {/* Footer: Acquis + Next */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acquisBtn, { backgroundColor: colors.boutonyes as string }]}
          onPress={markAcquis}
        >
          <Ionicons name="checkmark" size={20} color={colors.text as string} />
          <AppText style={[styles.footerBtnText, { color: colors.text as string }]}>
            Acquis
          </AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: `${colors.flash as string}80` }]}
          onPress={() => goTo(current + 1)}
        >
          <AppText style={[styles.footerBtnText, { color: colors.text as string }]}>
            Suivant
          </AppText>
          <Ionicons name="arrow-forward" size={20} color={colors.text as string} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  barsScroll: { flex: 1 },
  barsContent: { flexDirection: "row", alignItems: "center" },
  bar: { height: 8, borderRadius: 4 },
  resetBtn: { padding: 8, marginLeft: 8 },
  toReviewText: {
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  faceBtns: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 10,
  },
  faceBtn: {
    paddingVertical: 7,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  faceBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  cardScroll: { flex: 1 },
  footer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    justifyContent: "center",
  },
  acquisBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
