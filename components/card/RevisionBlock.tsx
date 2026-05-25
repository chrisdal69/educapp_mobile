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
  textColor: string,
  cardBg: string,
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
html,body{background:${bgColor};-webkit-tap-highlight-color:transparent}
body{font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',sans-serif;color:${textColor};padding:5px}
.scene{perspective:1200px;width:100%}
.card-inner{
  position:relative;width:100%;
  transform-style:preserve-3d;
  transition:transform 0.5s cubic-bezier(0.4,0,0.2,1);
  border-radius:18px;
}
.card-inner.flipped{transform:rotateY(180deg)}
.face{
  width:100%;padding:0px 0px;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  backface-visibility:hidden;-webkit-backface-visibility:hidden;
  background:${cardBg};border-radius:18px;
  min-height:200px;
}
.face-back{position:absolute;top:0;left:0;right:0;bottom:0;transform:rotateY(180deg)}
.card-img{max-width:100%;max-height:65vh;border-radius:12px;object-fit:contain}
.placeholder{font-size:18px;color:${textColor};opacity:0.5;padding:40px;text-align:center}
</style></head>
<body>
<div class="scene">
  <div id="card-inner" class="card-inner">
    <div id="face-recto" class="face face-front">${rectoImg}</div>
    <div id="face-verso" class="face face-back">${versoImg}</div>
  </div>
</div>
<script>
function flip(side){
  var card=document.getElementById('card-inner');
  if(side==='verso'){card.classList.add('flipped');}
  else{card.classList.remove('flipped');}
}
window.addEventListener('load',function(){
  var recto=document.getElementById('face-recto');
  var verso=document.getElementById('face-verso');
  var card=document.getElementById('card-inner');
  verso.style.visibility='hidden';verso.style.position='relative';verso.style.transform='none';
  var h2=verso.offsetHeight;
  verso.style.position='';verso.style.visibility='';verso.style.transform='';
  var h1=recto.offsetHeight;
  var maxH=Math.max(h1,h2,200);
  card.style.height=maxH+'px';
  recto.style.height=maxH+'px';
  var h=Math.max(document.body.scrollHeight,document.documentElement.scrollHeight);
  window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'load',h:h}));
  card.addEventListener('click',function(){
    window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({t:'flip'}));
  });
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
  const allFlashRef = useRef<UserFlash[]>([]);

  const [allFlash, setAllFlash] = useState<UserFlash[]>([]);
  const [userPrefix, setUserPrefix] = useState<string>("");
  const [deck, setDeck] = useState<UserFlash[]>([]);
  const [current, setCurrent] = useState(0);
  const [side, setSide] = useState<"recto" | "verso">("recto");
  const [acquis, setAcquis] = useState<Set<string>>(new Set());
  const [cardHeight, setCardHeight] = useState(300);
  const [wrapperHeight, setWrapperHeight] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scanVisible, setScanVisible] = useState(false);
  const [deleting, setDeleting] = useState(false);

  currentRef.current = current;
  sideRef.current = side;
  acquisRef.current = acquis;
  deckRef.current = deck;
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
  const allFlashActiveIdx = allFlash.findIndex((fi) => fi.id === deck[current]?.id);
  useEffect(() => {
    if (allFlash.length > 0) onCurrentChange?.(allFlashActiveIdx, allFlash.length);
  }, [allFlashActiveIdx, allFlash.length, onCurrentChange]);

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
    if (idx >= d.length) {
      const nonAcquis = allFlashRef.current.filter((fi) => !acquisRef.current.has(fi.id));
      const acquisList = allFlashRef.current.filter((fi) => acquisRef.current.has(fi.id));
      if (nonAcquis.length === 0) {
        setDeck(shuffle([...allFlashRef.current]));
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
  }, []);

  const markAcquis = useCallback(() => {
    const f = deckRef.current[currentRef.current];
    if (!f) return;
    const next = new Set(acquisRef.current);
    if (next.has(f.id)) {
      next.delete(f.id);
    } else {
      next.add(f.id);
    }
    acquisRef.current = next;
    setAcquis(next);
  }, []);

  const handleReset = useCallback(() => {
    acquisRef.current = new Set();
    setAcquis(new Set());
    if (card._id) storageDelete(acquisStorageKey(card._id));
    setDeck(shuffle(allFlashRef.current));
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
  const MAX_VISIBLE = 8;
  const RESET_WIDTH = 48;
  const availableWidth = screenWidth - 32 - RESET_WIDTH;
  const n = Math.max(1, Math.min(allFlash.length, MAX_VISIBLE));
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
            colors.text as string,
            "transparent",
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
          {allFlash.map((fi, idx) => {
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
                    borderWidth: idx === allFlashActiveIdx ? 1.5 : 0,
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

          {/* NavZone : juste sous la carte, tap = carte suivante */}
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

      {/* Suivant */}
      <View style={styles.suivantRow}>
        <TouchableOpacity
          style={[styles.nextBtn, { backgroundColor: `${colors.flash as string}80` }]}
          onPress={() => goTo(currentRef.current + 1)}
        >
          <AppText style={[styles.footerBtnText, { color: colors.text as string }]}>
            Suivant
          </AppText>
          <Ionicons name="arrow-forward" size={20} color={colors.text as string} />
        </TouchableOpacity>
      </View>

      {/* Footer: Acquis + Add + Delete */}
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
  suivantRow: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingBottom: 4,
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
