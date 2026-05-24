import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import {
  View,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Image,
} from "react-native";
import WebView from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import DocumentScanner from "react-native-document-scanner-plugin";
import * as ImageManipulator from "expo-image-manipulator";
import RNBlobUtil from "react-native-blob-util";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/apiClient";
import { storageGet, storageSet, storageDelete } from "@/utils/storage";
import { buildCardUserFlashImageUrl } from "@/utils/gcsPaths";
import type { Card } from "@/types/cards";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserFlash = {
  id: string;
  imquestion: string;
  imreponse?: string;
};

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

function buildUserFlashHtml(
  rectoUrl: string,
  versoUrl: string,
  bgColor: string,
  textColor: string
): string {
  const rectoImg = rectoUrl
    ? `<img src="${rectoUrl}" class="card-img" />`
    : `<div class="placeholder">Recto</div>`;
  const versoImg = versoUrl
    ? `<img src="${versoUrl}" class="card-img" />`
    : `<div class="placeholder">Verso non défini</div>`;
  return `<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:${bgColor};height:100%}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;
  display:flex;align-items:center;justify-content:center;
  padding:16px;
  color:${textColor};
  -webkit-tap-highlight-color:transparent;
}
.face{display:none;width:100%;text-align:center}
.face.active{display:block}
.card-img{max-width:100%;max-height:70vh;border-radius:12px;object-fit:contain}
.placeholder{font-size:18px;color:${textColor};opacity:0.5;padding:40px}
</style></head>
<body>
<div id="face-recto" class="face active">${rectoImg}</div>
<div id="face-verso" class="face">${versoImg}</div>
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

const acquisStorageKey = (cardId: string) => `revision_acquis_${cardId}`;

// ── Scanner modal ─────────────────────────────────────────────────────────────

type ScanStep = "preview" | "uploading" | "error";

type ScanFlashModalProps = {
  visible: boolean;
  card: Card;
  onClose: () => void;
  onDone: (newFlash: UserFlash) => void;
};

function ScanFlashModal({ visible, card, onClose, onDone }: ScanFlashModalProps) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const thumbSize = (screenWidth - 64) / 2;

  const [rectoUri, setRectoUri] = useState<string | null>(null);
  const [versoUri, setVersoUri] = useState<string | null>(null);
  const [step, setStep] = useState<ScanStep>("preview");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setRectoUri(null);
    setVersoUri(null);
    setStep("preview");
    setProgress("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const scanSide = async (side: "recto" | "verso") => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument({ maxNumDocuments: 1 });
      if (!scannedImages?.length) return;
      const uri = scannedImages[0];
      if (side === "recto") setRectoUri(uri);
      else setVersoUri(uri);
    } catch {}
  };

  const upload = async () => {
    if (!rectoUri) return;
    setStep("uploading");
    setProgress("Redimensionnement...");
    try {
      // Resize images
      const resizedRecto = await ImageManipulator.manipulateAsync(
        rectoUri,
        [{ resize: { width: 600 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );
      const resizedVerso = versoUri
        ? await ImageManipulator.manipulateAsync(
            versoUri,
            [{ resize: { width: 600 } }],
            { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
          )
        : null;

      // Upload recto
      setProgress("Envoi du recto...");
      const rectoFilename = `recto_${Date.now()}.jpg`;
      const rectoSignedRes = await apiFetch("/userflashes/signed-url", {
        method: "POST",
        body: JSON.stringify({ cardId: card._id, side: "recto", filename: rectoFilename }),
      });
      if (!rectoSignedRes.ok) throw new Error("Erreur signed URL recto");
      const { signedUrl: rectoSignedUrl, filename: rectoGcsFilename } =
        await rectoSignedRes.json();
      const rectoUpload = await RNBlobUtil.fetch(
        "PUT",
        rectoSignedUrl,
        { "Content-Type": "image/jpeg" },
        RNBlobUtil.wrap(resizedRecto.uri.replace("file://", ""))
      );
      if (rectoUpload.respInfo.status >= 400) throw new Error("Échec upload recto");

      // Upload verso
      let versoGcsFilename: string | undefined;
      if (resizedVerso) {
        setProgress("Envoi du verso...");
        const versoFilename = `verso_${Date.now()}.jpg`;
        const versoSignedRes = await apiFetch("/userflashes/signed-url", {
          method: "POST",
          body: JSON.stringify({ cardId: card._id, side: "verso", filename: versoFilename }),
        });
        if (!versoSignedRes.ok) throw new Error("Erreur signed URL verso");
        const { signedUrl: versoSignedUrl, filename: vGcsFilename } =
          await versoSignedRes.json();
        const versoUpload = await RNBlobUtil.fetch(
          "PUT",
          versoSignedUrl,
          { "Content-Type": "image/jpeg" },
          RNBlobUtil.wrap(resizedVerso.uri.replace("file://", ""))
        );
        if (versoUpload.respInfo.status >= 400) throw new Error("Échec upload verso");
        versoGcsFilename = vGcsFilename;
      }

      // Confirm
      setProgress("Enregistrement...");
      const confirmRes = await apiFetch("/userflashes/confirm", {
        method: "POST",
        body: JSON.stringify({
          cardId: card._id,
          rectoFilename: rectoGcsFilename,
          versoFilename: versoGcsFilename,
        }),
      });
      if (!confirmRes.ok) throw new Error("Erreur enregistrement");
      const { flash: newFlash } = await confirmRes.json();

      reset();
      onDone(newFlash);
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
      setStep("error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={scanStyles.overlay}>
        <View style={[scanStyles.sheet, { backgroundColor: colors.bgflash }]}>
          {/* Header */}
          <View style={[scanStyles.header, { backgroundColor: colors.flash as string }]}>
            <AppText style={[scanStyles.headerTitle, { color: colors.text }]}>
              {step === "uploading" ? progress : "Nouvelle carte"}
            </AppText>
            <TouchableOpacity onPress={handleClose} style={scanStyles.closeBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {step === "preview" && (
            <View style={scanStyles.body}>
              {/* Thumbnails */}
              <View style={scanStyles.thumbRow}>
                <TouchableOpacity
                  style={[
                    scanStyles.thumbBox,
                    { width: thumbSize, height: thumbSize, borderColor: colors.flash as string },
                  ]}
                  onPress={() => scanSide("recto")}
                >
                  {rectoUri ? (
                    <Image source={{ uri: rectoUri }} style={{ width: thumbSize, height: thumbSize, borderRadius: 10 }} />
                  ) : (
                    <View style={scanStyles.thumbPlaceholder}>
                      <Ionicons name="scan-outline" size={32} color={colors.muted as string} />
                      <AppText style={{ color: colors.muted as string, fontSize: 13, marginTop: 6 }}>
                        Recto *
                      </AppText>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    scanStyles.thumbBox,
                    { width: thumbSize, height: thumbSize, borderColor: colors.flash as string },
                  ]}
                  onPress={() => scanSide("verso")}
                >
                  {versoUri ? (
                    <Image source={{ uri: versoUri }} style={{ width: thumbSize, height: thumbSize, borderRadius: 10 }} />
                  ) : (
                    <View style={scanStyles.thumbPlaceholder}>
                      <Ionicons name="scan-outline" size={32} color={colors.muted as string} />
                      <AppText style={{ color: colors.muted as string, fontSize: 13, marginTop: 6 }}>
                        Verso (optionnel)
                      </AppText>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <AppText style={{ color: colors.textSecondary as string, fontSize: 12, textAlign: "center" }}>
                Appuyez sur une case pour scanner
              </AppText>

              {/* Actions */}
              <View style={scanStyles.actions}>
                {rectoUri && (
                  <TouchableOpacity
                    style={[scanStyles.btn, { backgroundColor: colors.boutonyes as string }]}
                    onPress={upload}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color={colors.text} />
                    <AppText style={[scanStyles.btnText, { color: colors.text }]}>
                      Enregistrer
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {step === "uploading" && (
            <View style={[scanStyles.body, scanStyles.center]}>
              <ActivityIndicator size="large" color={colors.primary as string} />
            </View>
          )}

          {step === "error" && (
            <View style={[scanStyles.body, scanStyles.center]}>
              <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
              <AppText style={{ color: colors.text, fontSize: 15, textAlign: "center", marginVertical: 12 }}>
                {error}
              </AppText>
              <TouchableOpacity
                style={[scanStyles.btn, { backgroundColor: colors.flash as string }]}
                onPress={() => setStep("preview")}
              >
                <AppText style={[scanStyles.btnText, { color: colors.text }]}>Réessayer</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const scanStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  sheet: {
    flex: 1,
    marginTop: Platform.OS === "ios" ? "13%" : "1%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    paddingTop: 24,
  },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  closeBtn: { padding: 4 },
  body: { flex: 1, padding: 20, gap: 16 },
  center: { alignItems: "center", justifyContent: "center" },
  thumbRow: { flexDirection: "row", gap: 16, justifyContent: "center" },
  thumbBox: {
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: "dashed",
    overflow: "hidden",
  },
  thumbPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center" },
  actions: { gap: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  btnText: { fontSize: 16, fontWeight: "600" },
});

// ── Main component ─────────────────────────────────────────────────────────────

type Props = {
  card: Card;
  onClose: () => void;
  onCurrentChange?: (current: number, total: number) => void;
};

export default function RevisionBlock({ card, onCurrentChange }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { width: screenWidth } = useWindowDimensions();

  const webviewRef = useRef<WebView>(null);
  const currentRef = useRef(0);
  const sideRef = useRef<"recto" | "verso">("recto");
  const acquisRef = useRef<Set<string>>(new Set());
  const deckRef = useRef<UserFlash[]>([]);
  const deckPhaseRef = useRef<1 | 2>(1);
  const allFlashRef = useRef<UserFlash[]>([]);

  const [allFlash, setAllFlash] = useState<UserFlash[]>([]);
  const [userPrefix, setUserPrefix] = useState<string>("");
  const [deck, setDeck] = useState<UserFlash[]>([]);
  const [deckPhase, setDeckPhase] = useState<1 | 2>(1);
  const [current, setCurrent] = useState(0);
  const [side, setSide] = useState<"recto" | "verso">("recto");
  const [acquis, setAcquis] = useState<Set<string>>(new Set());
  const [cardHeight, setCardHeight] = useState(300);
  const [loading, setLoading] = useState(true);
  const [scanVisible, setScanVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  currentRef.current = current;
  sideRef.current = side;
  acquisRef.current = acquis;
  deckRef.current = deck;
  deckPhaseRef.current = deckPhase;
  allFlashRef.current = allFlash;

  // Fetch userflashes and load acquis
  const fetchFlashes = useCallback(async (keepAcquis?: Set<string>) => {
    if (!card._id) { setLoading(false); return; }
    try {
      const [flashRes, storageRaw] = await Promise.all([
        apiFetch(`/userflashes?cardId=${card._id}`),
        keepAcquis !== undefined
          ? Promise.resolve(null)
          : storageGet(acquisStorageKey(card._id)),
      ]);

      const data = flashRes.ok ? await flashRes.json() : { flash: [], userPrefix: "" };
      const flashes: UserFlash[] = data.flash ?? [];
      const prefix: string = data.userPrefix ?? "";

      let acquisSet = keepAcquis ?? new Set<string>();
      if (!keepAcquis && storageRaw) {
        try { acquisSet = new Set<string>(JSON.parse(storageRaw)); } catch {}
      }

      acquisRef.current = acquisSet;
      allFlashRef.current = flashes;
      setAllFlash(flashes);
      setUserPrefix(prefix);
      setAcquis(acquisSet);
      setDeck(shuffle(flashes));
      setDeckPhase(1);
      setCurrent(0);
      setSide("recto");
      setCardHeight(300);
    } catch {}
    setLoading(false);
  }, [card._id]);

  useEffect(() => {
    fetchFlashes();
  }, [fetchFlashes]);

  // Notify parent of progress
  useEffect(() => {
    if (deck.length > 0) onCurrentChange?.(current, deck.length);
  }, [current, deck.length, onCurrentChange]);

  // Persist acquis changes
  useEffect(() => {
    if (loading || !card._id) return;
    storageSet(acquisStorageKey(card._id), JSON.stringify([...acquis]));
  }, [acquis, loading, card._id]);

  const injectCurrentSide = useCallback(() => {
    webviewRef.current?.injectJavaScript(`flip('${sideRef.current}');true;`);
  }, []);

  const goTo = useCallback((idx: number) => {
    if (idx < 0) return;
    const d = deckRef.current;
    const phase = deckPhaseRef.current;
    if (idx >= d.length) {
      const nonAcquis = allFlashRef.current.filter((fi) => !acquisRef.current.has(fi.id));
      if (phase === 1 && nonAcquis.length > 0 && nonAcquis.length < allFlashRef.current.length) {
        setDeck(shuffle(nonAcquis));
        setDeckPhase(2);
      } else {
        setDeck(shuffle(allFlashRef.current));
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
  }, []);

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
    setDeck(shuffle(allFlashRef.current));
    setDeckPhase(1);
    setCurrent(0);
    setSide("recto");
    setCardHeight(300);
  }, [card._id]);

  const flipTo = useCallback((newSide: "recto" | "verso") => {
    if (newSide === sideRef.current) return;
    sideRef.current = newSide;
    setSide(newSide);
    webviewRef.current?.injectJavaScript(`flip('${newSide}');true;`);
  }, []);

  const handleDelete = useCallback(() => {
    const f = deckRef.current[currentRef.current];
    if (!f) return;
    Alert.alert(
      "Supprimer cette carte ?",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            try {
              const res = await apiFetch(
                `/userflashes/${f.id}?cardId=${card._id}`,
                { method: "DELETE" }
              );
              if (!res.ok) throw new Error();
              // Remove from allFlash, rebuild deck
              const nextAll = allFlashRef.current.filter((fi) => fi.id !== f.id);
              const nextAcquis = new Set(acquisRef.current);
              nextAcquis.delete(f.id);
              allFlashRef.current = nextAll;
              acquisRef.current = nextAcquis;
              setAllFlash(nextAll);
              setAcquis(nextAcquis);
              const nextDeck = deckRef.current.filter((fi) => fi.id !== f.id);
              setDeck(nextDeck);
              const newIdx = Math.min(currentRef.current, nextDeck.length - 1);
              setCurrent(Math.max(0, newIdx));
              setSide("recto");
              setCardHeight(300);
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer la carte.");
            } finally {
              setDeleting(false);
            }
          },
        },
      ]
    );
  }, [card._id]);

  const handleScanDone = useCallback((newFlash: UserFlash) => {
    setScanVisible(false);
    const nextAll = [...allFlashRef.current, newFlash];
    allFlashRef.current = nextAll;
    setAllFlash(nextAll);
    const newCardIdx = deckRef.current.length;
    setDeck((prev) => [...prev, newFlash]);
    setCurrent(newCardIdx);
    setSide("recto");
    setCardHeight(300);
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
    (fi: UserFlash): string =>
      acquis.has(fi.id) ? (colors.boutonyes as string) : (colors.muted as string),
    [acquis, colors]
  );

  // ── Current card HTML ─────────────────────────────────────────────────────

  const f = deck[current];

  const rectoUrl = useMemo(() => {
    if (!f?.imquestion || !user?.directoryname || !userPrefix) return "";
    return buildCardUserFlashImageUrl({
      directoryname: user.directoryname,
      repertoire: card.repertoire,
      num: card.num,
      userPrefix,
      filename: f.imquestion,
    });
  }, [f?.id, f?.imquestion, user?.directoryname, userPrefix, card.repertoire, card.num]); // eslint-disable-line react-hooks/exhaustive-deps

  const versoUrl = useMemo(() => {
    if (!f?.imreponse || !user?.directoryname || !userPrefix) return "";
    return buildCardUserFlashImageUrl({
      directoryname: user.directoryname,
      repertoire: card.repertoire,
      num: card.num,
      userPrefix,
      filename: f.imreponse,
    });
  }, [f?.id, f?.imreponse, user?.directoryname, userPrefix, card.repertoire, card.num]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardHtml = useMemo(
    () =>
      f
        ? buildUserFlashHtml(
            rectoUrl,
            versoUrl,
            colors.bgflash as string,
            colors.text as string
          )
        : "",
    [f?.id, rectoUrl, versoUrl, colors.bgflash, colors.text] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const nonAcquisCount = useMemo(
    () => allFlash.filter((fi) => !acquis.has(fi.id)).length,
    [allFlash, acquis]
  );

  const canAdd =
    !card.nbUserFlashes || allFlash.length < card.nbUserFlashes;

  // ── Early returns ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary as string} />
      </View>
    );
  }

  const bgFlash = colors.bgflash as string;

  // ── Empty state ───────────────────────────────────────────────────────────

  if (allFlash.length === 0) {
    return (
      <View style={[styles.centered, { backgroundColor: bgFlash }]}>
        <Ionicons name="albums-outline" size={56} color={colors.muted as string} />
        <AppText style={{ color: colors.muted as string, fontSize: 16, marginTop: 12, textAlign: "center" }}>
          Vous n'avez pas encore de cartes.
        </AppText>
        {canAdd && (
          <TouchableOpacity
            style={[styles.addEmptyBtn, { backgroundColor: colors.flash as string }]}
            onPress={() => setScanVisible(true)}
          >
            <Ionicons name="add" size={22} color={colors.text} />
            <AppText style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>
              Créer ma première carte
            </AppText>
          </TouchableOpacity>
        )}
        <ScanFlashModal
          visible={scanVisible}
          card={card}
          onClose={() => setScanVisible(false)}
          onDone={handleScanDone}
        />
      </View>
    );
  }

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

      {/* Footer: Acquis + Add + Delete */}
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

        {canAdd && (
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: `${colors.flash as string}80` }]}
            onPress={() => setScanVisible(true)}
          >
            <Ionicons name="add" size={24} color={colors.text as string} />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.iconBtn, { backgroundColor: `${colors.boutonno as string}80` }]}
          onPress={handleDelete}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.text as string} />
          ) : (
            <Ionicons name="trash-outline" size={22} color={colors.text as string} />
          )}
        </TouchableOpacity>
      </View>

      <ScanFlashModal
        visible={scanVisible}
        card={card}
        onClose={() => setScanVisible(false)}
        onDone={handleScanDone}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
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
    alignItems: "center",
  },
  acquisBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  addEmptyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    marginTop: 8,
  },
});
