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
import { buildCardFlashImageUrl, buildCardBgUrl } from "@/utils/gcsPaths";
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
  textColor: string,
  cardBg: string,
  bgImageUrl: string,
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
html,body{background:${bgColor};-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:${textColor};padding:16px}
.scene{perspective:1200px;width:100%}
.card-inner{
  position:relative;width:100%;
  transform-style:preserve-3d;
  transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);
  border-radius:18px;
  border:1px solid ${textColor}60;
  box-shadow:0 6px 24px rgba(0,0,0,0.45);
}
.card-inner.flipped{transform:rotateY(180deg)}
.face{
  width:100%;padding:28px 20px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  background:${cardBg};border-radius:18px;
}
.face-back{position:absolute;top:0;left:0;right:0;bottom:0;transform:rotateY(180deg)}
#bg-blur-layer{position:absolute;top:0;left:0;right:0;bottom:0;background-size:cover;background-position:center;border-radius:18px;transition:opacity 0.5s cubic-bezier(0.4,0,0.2,1)}
.text-wrap{width:100%;display:flex;justify-content:center}
.text{max-width:100%;text-align:left;font-size:22px;line-height:1.4}
.img-wrap{text-align:center;margin-top:18px;width:100%}
.img-wrap img{max-width:100%;max-height:370px;border-radius:10px;object-fit:contain}
math{font-size:1em}
</style></head>
<body>
<div class="scene">
  <div id="card-inner" class="card-inner">
    ${bgImageUrl ? `<div id="bg-blur-layer" style="background-image:url('${bgImageUrl}')"></div>` : ""}
    <div id="face-recto" class="face face-front" ${bgImageUrl ? `style="background:transparent"` : ""}>
      <div class="text-wrap"><div id="text-recto" class="text">${rectoText}</div></div>
      ${rectoImg}
    </div>
    <div id="face-verso" class="face face-back">
      <div class="text-wrap"><div id="text-verso" class="text">${versoText}</div></div>
      ${versoImg}
    </div>
  </div>
</div>
<script>
function applyBinarySearch(el){
  if(!el)return;
  var cw=el.parentElement?el.parentElement.clientWidth:window.innerWidth;
  el.style.width='max-content';
  if(el.scrollWidth>=cw){
    el.style.width=cw+'px';
    var refH=el.offsetHeight;
    var lo=20,hi=cw;
    for(var s=0;s<16;s++){var mid=(lo+hi)/2;el.style.width=mid+'px';if(el.offsetHeight<=refH)hi=mid;else lo=mid;}
    el.style.width=Math.ceil(hi)+'px';
  }
}
function flip(side){
  var card=document.getElementById('card-inner');
  var blur=document.getElementById('bg-blur-layer');
  if(side==='verso'){card.classList.add('flipped');if(blur)blur.style.opacity='0';}
  else{card.classList.remove('flipped');if(blur)blur.style.opacity='0.2';}
}
window.addEventListener('load',function(){
  applyBinarySearch(document.getElementById('text-recto'));
  var back=document.getElementById('face-verso');
  back.style.visibility='hidden';back.style.position='relative';back.style.transform='none';
  applyBinarySearch(document.getElementById('text-verso'));
  var h2=back.offsetHeight;
  back.style.position='';back.style.visibility='';back.style.transform='';
  var h1=document.getElementById('face-recto').offsetHeight;
  var maxH=Math.max(h1,h2);
  var card=document.getElementById('card-inner');
  card.style.height=maxH+'px';
  document.getElementById('face-recto').style.height=maxH+'px';
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'load',h:h}));
  document.getElementById('card-inner').addEventListener('click',function(){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'flip'}));
  });
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
  const [wrapperHeight, setWrapperHeight] = useState(0);
  const [deck, setDeck] = useState<CardFlash[]>([]);
  const [current, setCurrent] = useState(0);
  const [side, setSide] = useState<"recto" | "verso">("recto");
  const [acquis, setAcquis] = useState<Set<string>>(new Set());
  const [cardHeight, setCardHeight] = useState(300);
  const [ready, setReady] = useState(false);

  currentRef.current = current;
  sideRef.current = side;
  acquisRef.current = acquis;
  deckRef.current = deck;

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
  const flashActiveIdx = flash.findIndex((fi) => fi.id === deck[current]?.id);
  useEffect(() => {
    if (flash.length > 0) onCurrentChange?.(flashActiveIdx, flash.length);
  }, [flashActiveIdx, flash.length, onCurrentChange]);

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
      if (idx >= d.length) {
        const nonAcquis = flash.filter((fi) => !acquisRef.current.has(fi.id));
        const acquisList = flash.filter((fi) => acquisRef.current.has(fi.id));
        if (nonAcquis.length === 0) {
          setDeck(shuffle([...flash]));
        } else if (acquisList.length === 0) {
          setDeck(shuffle(nonAcquis));
        } else {
          const randomAcquired = acquisList[Math.floor(Math.random() * acquisList.length)];
          setDeck(shuffle([...nonAcquis, randomAcquired]));
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
    if (next.has(f.id)) {
      next.delete(f.id);
      acquisRef.current = next;
      setAcquis(next);
    } else {
      next.add(f.id);
      acquisRef.current = next;
      setAcquis(next);
    }
  }, [goTo]);

  const handleReset = useCallback(() => {
    acquisRef.current = new Set();
    setAcquis(new Set());
    if (card._id) storageDelete(acquisStorageKey(card._id));
    setDeck(shuffle(flash));
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
  const MAX_VISIBLE = 8;
  const RESET_WIDTH = 48;
  const availableWidth = screenWidth - 32 - RESET_WIDTH;
  const n = Math.max(1, Math.min(flash.length, MAX_VISIBLE));
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

  const cardBgImageUrl = useMemo(
    () =>
      card.bg && user?.directoryname
        ? buildCardBgUrl({
            directoryname: user.directoryname,
            repertoire: card.repertoire,
            num: card.num,
            bg: card.bg,
            mobile: false,
          })
        : "",
    [card.bg, user?.directoryname, card.repertoire, card.num]
  );

  const cardHtml = useMemo(
    () =>
      f
        ? buildFlashHtml(
            f,
            rectoImageUrl,
            versoImageUrl,
            colors.bgflash as string,
            colors.text as string,
            colors.flash as string,
            cardBgImageUrl,
          )
        : "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [f?.id, rectoImageUrl, versoImageUrl, colors.bgflash, colors.text, colors.flash, cardBgImageUrl]
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
          {flash.map((fi, idx) => {
            const deckIdx = deck.findIndex((d) => d.id === fi.id);
            return (
              <TouchableOpacity
                key={fi.id}
                onPress={() => {
                  if (deckIdx >= 0) {
                    setCardHeight(300);
                    setSide("recto");
                    setCurrent(deckIdx);
                  } else {
                    const newDeck = [...deckRef.current];
                    const insertAt = currentRef.current + 1;
                    newDeck.splice(insertAt, 0, fi);
                    deckRef.current = newDeck;
                    setDeck(newDeck);
                    setCardHeight(300);
                    setSide("recto");
                    setCurrent(insertAt);
                  }
                }}
                hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
                style={[
                  styles.bar,
                  {
                    width: barWidth,
                    backgroundColor: getBarBg(fi),
                    borderWidth: idx === flashActiveIdx ? 1.5 : 0,
                    borderColor: colors.text as string,
                  },
                ]}
              />
            );
          })}
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
        <View style={styles.cardWrapper} onLayout={(e) => setWrapperHeight(e.nativeEvent.layout.height)}>
          <ScrollView
            style={[styles.cardScroll, { backgroundColor: bgFlash }]}
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
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
                    } else if (data.t === "flip") {
                      flipTo(sideRef.current === "recto" ? "verso" : "recto");
                    }
                  } catch {}
                }}
              />
            </View>
          </ScrollView>

          {/* NavZone : juste sous la carte, aussi haute que possible, tap = carte suivante */}
          {wrapperHeight > 0 && Math.ceil((wrapperHeight + cardHeight) / 2) < wrapperHeight && (
            <TouchableOpacity
              style={{
                position: "absolute",
                top: Math.ceil((wrapperHeight + cardHeight) / 2),
                left: 0,
                right: 0,
                bottom: 0,
              }}
              onPress={() => goTo(currentRef.current + 1)}
              activeOpacity={1}
            />
          )}
        </View>
      </GestureDetector>

      {/* Footer: Acquis + Next */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.acquisBtn, {
            backgroundColor: f && acquis.has(f.id)
              ? (colors.boutonyes as string)
              : `${colors.flash as string}80`,
          }]}
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  barsScroll: { flex: 1 },
  barsContent: { flexDirection: "row", alignItems: "center" },
  bar: { height: 12, borderRadius: 6 },
  resetBtn: { padding: 8, marginLeft: 8 },
  toReviewText: {
    fontSize: 12,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  faceBtns: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 2,
    marginTop: 40,
    gap: 10,
    justifyContent: "center",
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
  cardWrapper: { flex: 1, position: "relative" },
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
