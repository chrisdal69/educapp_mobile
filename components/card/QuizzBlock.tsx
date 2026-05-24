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
import { apiFetch } from "@/utils/apiClient";
import { storageGet, storageSet, storageDelete } from "@/utils/storage";
import { buildCardQuizzImageUrl } from "@/utils/gcsPaths";
import type { Card, CardQuizz } from "@/types/cards";

// ── Math rendering ────────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
              katex.renderToString(buffer, {
                output: "mathml",
                throwOnError: false,
              }),
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

// ── HTML builder ──────────────────────────────────────────────────────────────

function buildQuestionHtml(
  q: CardQuizz,
  imageUrl: string,
  bgColor: string,
  textColor: string,
  trainingMode: boolean,
  optionBgEven: string,
  optionBgOdd: string,
  colorYes: string,
  colorNo: string,
): string {
  const questionHtml = renderInlineMath(q.question);
  const correctIdx = Number.isInteger(q.correct) ? q.correct : -1;
  const optionsHtml = q.options
    .map((opt, i) => {
      const bg = i % 2 === 0 ? optionBgEven : optionBgOdd;
      const letter = String.fromCharCode(65 + i); // A, B, C, D…
      return `<div class="option" id="opt${i}" data-bg="${bg}" onclick="selectOpt(${i})">
  <span class="badge">${letter}</span>
  <span class="opt-text">${renderInlineMath(opt)}</span>
</div>`;
    })
    .join("");
  const hasImage = !!(imageUrl && q.image);
  const imageHtml = hasImage
    ? `<div class="img-wrap"><img src="${imageUrl}" /></div>`
    : "";
  const TM = trainingMode ? "true" : "false";
  const optCount = q.options.length;
  // max-height = 4 options × 64px + 3 gaps × 15px
  const optionsMaxHeight = 4 * 64 + 3 * 15;

  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html{background:${bgColor}}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
  font-size:17px;line-height:1.75;
  padding:1px 14px 12px;
  background:${bgColor};
  color:${textColor};
  -webkit-tap-highlight-color:transparent;
}
.question-wrap{
  min-height:${hasImage ? 0 : 350}px;
  display:flex;
  flex-direction:column;
  justify-content:center;
  align-items:center;
  padding:8px 0;
}
.question{
  max-width:100%;
  text-align:left;
  font-size:24px;
  line-height:1.3;
  margin-bottom:${hasImage ? 10 : 0}px;
}
.img-wrap{
  text-align:center;
}
.img-wrap img{
  width:100%;
  max-height:270px;
  border-radius:8px;
  object-fit:contain;
}
.options{
  display:flex;
  flex-direction:column;
  gap:15px;
  max-height:${optionsMaxHeight}px;
  overflow-y:auto;
  -webkit-overflow-scrolling:touch;
  padding-bottom:4px;
}
.option{
  display:flex;
  align-items:center;
  line-height:1.3;
  gap:12px;
  height:64px;
  flex-shrink:0;
  padding:1px 14px;
  border-radius:12px;
  border:1.5px solid transparent;
  cursor:pointer;
  font-size:20px;
  user-select:none;
  -webkit-user-select:none;
  transition:border-color 0.12s;
}
.badge{
  min-width:28px;
  height:28px;
  border-radius:14px;
  background:rgba(0,0,0,0.15);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:700;
  font-size:14px;
  flex-shrink:0;
}
.opt-text{flex:1}
.opt-selected{border-color:rgba(128,128,128,0.6)}
.opt-correct{border-color:${colorYes};background:${colorYes}BB}
.opt-wrong{border-color:${colorNo};background:${colorNo}BB}
math{font-size:1em}
</style></head>
<body>
<div class="question-wrap">
  <div class="question">${questionHtml}</div>
  ${imageHtml}
</div>
<div class="options">${optionsHtml}</div>
<script>
var TM=${TM};
var CORRECT=${correctIdx};
var N=${optCount};
function selectOpt(i){
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'select',v:i}));
}
function updateState(answer,firstAnswer,submitted,showResults){
  for(var i=0;i<N;i++){
    var el=document.getElementById('opt'+i);
    if(!el)continue;
    var isSel=(answer===i);
    var cls='option';
    if(TM){
      if(isSel){
        cls+=(CORRECT>=0&&i===CORRECT)?' opt-correct':' opt-wrong';
      }
    }else if(submitted&&showResults){
      if(i===CORRECT)cls+=' opt-correct';
      else if(isSel)cls+=' opt-wrong';
    }else if(isSel){
      cls+=' opt-selected';
    }
    el.className=cls;
    if(cls.indexOf('opt-correct')>=0)el.style.backgroundColor='${colorYes}';
    else if(cls.indexOf('opt-wrong')>=0)el.style.backgroundColor='${colorNo}';
    else el.style.backgroundColor=el.dataset.bg;
  }
}
window.addEventListener('load',function(){
  for(var i=0;i<N;i++){var el=document.getElementById('opt'+i);if(el)el.style.backgroundColor=el.dataset.bg;}
  var q=document.querySelector('.question');
  if(q){
    var cw=q.parentElement?q.parentElement.clientWidth:window.innerWidth;
    q.style.width='max-content';
    if(q.scrollWidth>=cw){
      q.style.width=cw+'px';
      var refH=q.offsetHeight;
      var lo=20,hi=cw;
      for(var s=0;s<16;s++){var mid=(lo+hi)/2;q.style.width=mid+'px';if(q.offsetHeight<=refH)hi=mid;else lo=mid;}
      q.style.width=Math.ceil(hi)+'px';
    }
  }
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'load',h:h}));
});
</script>
</body></html>`;
}

// ── Storage key ───────────────────────────────────────────────────────────────

const trainingStorageKey = (cardId: string) => `quizz_train_${cardId}`;

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  card: Card;
  onClose: () => void;
  onCurrentChange?: (current: number, total: number) => void;
};

export default function QuizzBlock({ card, onCurrentChange }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const quizz: CardQuizz[] = useMemo(() => card.quizz ?? [], [card._id]);
  const evalMode = card.evalQuizz === "oui";
  const trainingMode = !evalMode;

  const webviewRef = useRef<WebView>(null);
  const currentRef = useRef(0);
  const answersRef = useRef<Record<string, number>>({});
  const firstAnswersRef = useRef<Record<string, number>>({});
  const submittedRef = useRef(false);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [firstAnswers, setFirstAnswers] = useState<Record<string, number>>({});
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoreInfo, setScoreInfo] = useState<{
    correctCount: number;
    totalQuestions: number;
  } | null>(null);
  const [historyDate, setHistoryDate] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [questionHeight, setQuestionHeight] = useState(320);
  const [storageLoaded, setStorageLoaded] = useState(!trainingMode);

  // Keep refs in sync
  currentRef.current = current;
  answersRef.current = answers;
  firstAnswersRef.current = firstAnswers;
  submittedRef.current = submitted;

  // Load persisted training answers
  useEffect(() => {
    if (!trainingMode || !card._id) {
      setStorageLoaded(true);
      return;
    }
    storageGet(trainingStorageKey(card._id))
      .then((raw) => {
        if (raw) {
          try {
            const saved: Record<string, number> = JSON.parse(raw);
            firstAnswersRef.current = saved;
            setFirstAnswers(saved);
          } catch {}
        }
      })
      .finally(() => setStorageLoaded(true));
  }, [card._id, trainingMode]);

  // Persist firstAnswers whenever they change (training mode)
  useEffect(() => {
    if (!trainingMode || !card._id || !storageLoaded) return;
    if (Object.keys(firstAnswers).length === 0) return;
    storageSet(trainingStorageKey(card._id), JSON.stringify(firstAnswers));
  }, [firstAnswers, trainingMode, card._id, storageLoaded]);

  // Notify parent of progress
  useEffect(() => {
    onCurrentChange?.(current, quizz.length);
  }, [current, quizz.length, onCurrentChange]);

  // Fetch history for eval mode
  useEffect(() => {
    if (!evalMode || !user || !card._id) return;
    let cancelled = false;
    setHistoryLoading(true);
    apiFetch(`/quizzs/historique?cardId=${card._id}`)
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        if (payload?.alreadyDone) {
          submittedRef.current = true;
          setSubmitted(true);
          if (payload.date) setHistoryDate(payload.date);
          if (card.resultatQuizz && payload.correctCount !== undefined) {
            setScoreInfo({
              correctCount: payload.correctCount,
              totalQuestions: payload.totalQuestions,
            });
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [evalMode, user, card._id]);

  const injectCurrentState = useCallback(() => {
    const q = quizz[currentRef.current];
    if (!q || !webviewRef.current) return;
    const ans = answersRef.current[q.id];
    const fa = firstAnswersRef.current[q.id];
    const sub = submittedRef.current;
    const showResults = sub && !!card.resultatQuizz;
    webviewRef.current.injectJavaScript(
      `updateState(${ans !== undefined ? ans : "null"},${fa !== undefined ? fa : "null"},${sub},${showResults});true;`,
    );
  }, [quizz, card.resultatQuizz]);

  const handleOptionSelect = useCallback(
    (qid: string, optionIdx: number) => {
      if (submittedRef.current || pendingConfirm) return;
      const nextAnswers = { ...answersRef.current, [qid]: optionIdx };
      answersRef.current = nextAnswers;
      setAnswers(nextAnswers);
      if (trainingMode && firstAnswersRef.current[qid] === undefined) {
        const nextFirst = { ...firstAnswersRef.current, [qid]: optionIdx };
        firstAnswersRef.current = nextFirst;
        setFirstAnswers(nextFirst);
      }
      const fa = firstAnswersRef.current[qid];
      webviewRef.current?.injectJavaScript(
        `updateState(${optionIdx},${fa !== undefined ? fa : optionIdx},false,false);true;`,
      );
    },
    [pendingConfirm, trainingMode],
  );

  const handleReset = useCallback(() => {
    answersRef.current = {};
    firstAnswersRef.current = {};
    setAnswers({});
    setFirstAnswers({});
    if (card._id) storageDelete(trainingStorageKey(card._id));
    webviewRef.current?.injectJavaScript(
      `updateState(null,null,false,false);true;`,
    );
  }, [card._id]);

  const goTo = useCallback(
    (idx: number) => {
      const clamped = Math.max(0, Math.min(quizz.length - 1, idx));
      if (clamped === currentRef.current) return;
      setQuestionHeight(320);
      setCurrent(clamped);
    },
    [quizz.length],
  );

  const handleSubmit = useCallback(async () => {
    if (!card._id || !user) return;
    const reponses = quizz.map((q) => answersRef.current[q.id] ?? 0);
    try {
      setSubmitting(true);
      const res = await apiFetch("/quizzs", {
        method: "POST",
        body: JSON.stringify({ cardId: card._id, reponses }),
      });
      const payload = await res.json().catch(() => ({}));
      submittedRef.current = true;
      setSubmitted(true);
      setPendingConfirm(false);
      if (payload.date) setHistoryDate(payload.date);
      if (card.resultatQuizz && payload.correctCount !== undefined) {
        setScoreInfo({
          correctCount: payload.correctCount,
          totalQuestions: payload.totalQuestions,
        });
      }
      const q = quizz[currentRef.current];
      if (q && webviewRef.current) {
        const ans = answersRef.current[q.id];
        webviewRef.current.injectJavaScript(
          `updateState(${ans !== undefined ? ans : "null"},null,true,${!!card.resultatQuizz});true;`,
        );
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [card._id, user, quizz, card.resultatQuizz]);

  // ── Swipe gesture ─────────────────────────────────────────────────────────

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
  const RESET_WIDTH = trainingMode ? 48 : 0;
  const availableWidth = screenWidth - 32 - RESET_WIDTH;
  const barWidth = Math.max(
    20,
    (availableWidth - BAR_GAP * (Math.min(quizz.length, MAX_VISIBLE) - 1)) /
      Math.min(quizz.length, MAX_VISIBLE),
  );

  const getBarBg = useCallback(
    (q: CardQuizz): string => {
      if (trainingMode) {
        const fa = firstAnswers[q.id];
        if (fa === undefined) return colors.muted as string;
        return fa === q.correct
          ? (colors.boutonyes as string)
          : (colors.boutonno as string);
      }
      if (!submitted || !card.resultatQuizz) return colors.muted as string;
      const ans = answers[q.id];
      if (ans === undefined) return colors.muted as string;
      return ans === q.correct
        ? (colors.boutonyes as string)
        : (colors.boutonno as string);
    },
    [
      trainingMode,
      firstAnswers,
      submitted,
      card.resultatQuizz,
      answers,
      colors,
    ],
  );

  // ── Option colors (alternating) ───────────────────────────────────────────

  const quizzColor = colors.quizz as string;
  // Parse hex/hsl to add alpha — use rgba trick via CSS
  const optionBgEven = `${quizzColor}80`; // ~50% opacity (hex alpha)
  const optionBgOdd = quizzColor;

  // ── HTML for current question ─────────────────────────────────────────────

  const q = quizz[current];
  const imageUrl = useMemo(
    () =>
      q?.image && user?.directoryname
        ? buildCardQuizzImageUrl({
            directoryname: user.directoryname,
            repertoire: card.repertoire,
            num: card.num,
            filename: q.image,
          })
        : "",
    [q?.id, q?.image, user?.directoryname, card.repertoire, card.num],
  );

  const questionHtml = useMemo(
    () =>
      q
        ? buildQuestionHtml(
            q,
            imageUrl,
            colors.bgquizz as string,
            colors.text as string,
            trainingMode,
            optionBgEven,
            optionBgOdd,
            colors.boutonyes as string,
            colors.boutonno as string,
          )
        : "",
    [
      q?.id,
      imageUrl,
      colors.bgquizz,
      colors.text,
      trainingMode,
      optionBgEven,
      optionBgOdd,
      colors.boutonyes,
      colors.boutonno,
    ],
  );

  const allAnswered = quizz.every((qi) => answers[qi.id] !== undefined);

  // ── Early returns ─────────────────────────────────────────────────────────

  if (!storageLoaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (quizz.length === 0) {
    return (
      <View style={styles.centered}>
        <AppText style={{ color: colors.muted }}>
          Aucune question disponible.
        </AppText>
      </View>
    );
  }
  if (card.evalQuizz === "attente") {
    return (
      <View style={styles.centered}>
        <AppText style={{ color: colors.muted }}>
          Quizz en attente de validation.
        </AppText>
      </View>
    );
  }
  if (evalMode && !user) {
    return (
      <View style={styles.centered}>
        <AppText style={{ color: colors.muted }}>
          Connexion requise pour accéder au quizz.
        </AppText>
      </View>
    );
  }
  if (historyLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const bgQuizz = colors.bgquizz as string;

  return (
    <View style={[styles.container, { backgroundColor: bgQuizz }]}>
      {/* Progress indicator */}
      <View style={styles.progressRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.barsContent, { gap: BAR_GAP }]}
          style={styles.barsScroll}
        >
          {quizz.map((qi, idx) => (
            <TouchableOpacity
              key={qi.id}
              onPress={() => goTo(idx)}
              hitSlop={{ top: 16, bottom: 16, left: 4, right: 4 }}
              style={[
                styles.bar,
                {
                  width: barWidth,
                  backgroundColor: getBarBg(qi),
                  borderWidth: idx === current ? 1.5 : 0,
                  borderColor: colors.text as string,
                },
              ]}
            />
          ))}
        </ScrollView>
        {trainingMode && (
          <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
            <Ionicons
              name="refresh-outline"
              size={22}
              color={colors.textSecondary as string}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Question */}
      <GestureDetector gesture={swipeGesture}>
        <ScrollView
          style={[styles.questionScroll, { backgroundColor: bgQuizz }]}
          contentContainerStyle={{ minHeight: questionHeight }}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!pendingConfirm}
        >
          <View style={{ height: questionHeight, backgroundColor: bgQuizz }}>
            <WebView
              ref={webviewRef}
              key={q?.id ?? "empty"}
              source={{ html: questionHtml }}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              style={{ flex: 1, backgroundColor: "transparent" }}
              onMessage={(event) => {
                try {
                  const data = JSON.parse(event.nativeEvent.data);
                  if (data.t === "load") {
                    if (data.h > 0) setQuestionHeight(data.h + 24);
                    injectCurrentState();
                  } else if (data.t === "select" && q) {
                    handleOptionSelect(q.id, data.v);
                  }
                } catch {}
              }}
            />
            {/* Zones de tap gauche/droite sur la zone question uniquement */}
            <TouchableOpacity
              style={styles.tapZoneLeft}
              onPress={() => goTo(currentRef.current - 1)}
              activeOpacity={1}
            />
            <TouchableOpacity
              style={styles.tapZoneRight}
              onPress={() => goTo(currentRef.current + 1)}
              activeOpacity={1}
            />
          </View>
        </ScrollView>
      </GestureDetector>

      {/* Eval footer — submit / confirm */}
      {evalMode && !submitted && (
        <View style={styles.footer}>
          {!pendingConfirm ? (
            <TouchableOpacity
              style={[
                styles.submitBtn,
                {
                  backgroundColor: colors.quizz as string,
                  opacity: allAnswered ? 1 : 0.45,
                },
              ]}
              onPress={() => allAnswered && setPendingConfirm(true)}
            >
              <AppText style={styles.submitBtnText}>
                Envoyer mes réponses
              </AppText>
            </TouchableOpacity>
          ) : (
            <View style={styles.confirmRow}>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.boutonno },
                ]}
                onPress={() => setPendingConfirm(false)}
              >
                <AppText style={{ color: colors.text }}>Annuler</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.confirmBtn,
                  { backgroundColor: colors.boutonyes },
                ]}
                onPress={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.text} size="small" />
                ) : (
                  <AppText style={{ color: colors.text }}>Confirmer</AppText>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Eval footer — results */}
      {evalMode && submitted && (historyDate || scoreInfo) && (
        <View style={styles.footer}>
          {historyDate && (
            <AppText
              style={[
                styles.historyText,
                { color: colors.textSecondary as string },
              ]}
            >
              Soumis le{" "}
              {new Date(historyDate).toLocaleString("fr-FR", {
                dateStyle: "short",
                timeStyle: "short",
              })}
            </AppText>
          )}
          {scoreInfo && (
            <AppText
              style={[styles.scoreText, { color: colors.text as string }]}
            >
              Score : {scoreInfo.correctCount} / {scoreInfo.totalQuestions}
            </AppText>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  tapZoneLeft: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "20%",
    height: 350,
    zIndex: 10,
  },
  tapZoneRight: {
    position: "absolute",
    right: 0,
    top: 0,
    width: "20%",
    height: 350,
    zIndex: 10,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 2,
  },
  barsScroll: { flex: 1 },
  barsContent: { flexDirection: "row", alignItems: "center" , marginTop: 8},
  bar: { height: 8, borderRadius: 4 },
  resetBtn: { padding: 8, marginLeft: 8 },
  questionScroll: { flex: 1 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
    gap: 4,
  },
  submitBtn: {
    paddingVertical: 12,
    paddingHorizontal: 36,
    borderRadius: 12,
  },
  submitBtnText: { fontSize: 16, fontWeight: "600", color: "#fff" },
  confirmRow: { flexDirection: "row", gap: 12 },
  confirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 10,
    alignItems: "center",
    minWidth: 110,
  },
  historyText: { fontSize: 13 },
  scoreText: { fontSize: 20, fontWeight: "700" },
});
