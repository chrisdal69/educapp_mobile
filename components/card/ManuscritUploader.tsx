import { useState } from "react";
import {
  Modal,
  View,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  useWindowDimensions,
} from "react-native";
import DocumentScanner from "react-native-document-scanner-plugin";
import { PDFDocument } from "pdf-lib";
import RNBlobUtil from "react-native-blob-util";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { apiFetch } from "@/utils/apiClient";
import type { Card, UserFileEntry } from "@/types/cards";

type Step = "naming" | "scanning" | "processing" | "error";

type Props = {
  card: Card;
  visible: boolean;
  onClose: () => void;
  onUploadComplete: (file: UserFileEntry) => void;
};

export default function ManuscritUploader({ card, visible, onClose, onUploadComplete }: Props) {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const BODY_PADDING = 20;
  const THUMB_GAP = 10;
  const thumbWidth = (screenWidth - BODY_PADDING * 2) / 2.5 - THUMB_GAP;
  const thumbHeight = thumbWidth * 1.4;
  const [step, setStep] = useState<Step>("naming");
  const [displayName, setDisplayName] = useState("");
  const [scannedUris, setScannedUris] = useState<string[]>([]);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const reset = () => {
    setStep("naming");
    setDisplayName("");
    setScannedUris([]);
    setProgress("");
    setError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const validateName = () => {
    if (!displayName.trim()) return;
    setStep("scanning");
  };

  const startScan = async () => {
    try {
      const { scannedImages } = await DocumentScanner.scanDocument();
      if (!scannedImages?.length) return;
      setScannedUris((prev) => [...prev, ...scannedImages]);
    } catch {
      // annulé ou erreur
    }
  };

  const removePage = (index: number) => {
    setScannedUris((prev) => prev.filter((_, i) => i !== index));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    const next = index + direction;
    if (next < 0 || next >= scannedUris.length) return;
    setScannedUris((prev) => {
      const arr = [...prev];
      [arr[index], arr[next]] = [arr[next], arr[index]];
      return arr;
    });
  };

  const buildAndUpload = async () => {
    if (scannedUris.length === 0) return;
    setStep("processing");
    try {
      setProgress("Assemblage du PDF...");
      const A4_W = 595.28;
      const A4_H = 841.89;
      const pdfDoc = await PDFDocument.create();

      for (const uri of scannedUris) {
        const clean = uri.replace("file://", "");
        const b64 = await RNBlobUtil.fs.readFile(clean, "base64");
        const jpegBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const jpegImage = await pdfDoc.embedJpg(jpegBytes);
        const page = pdfDoc.addPage([A4_W, A4_H]);
        page.drawImage(jpegImage, { x: 0, y: 0, width: A4_W, height: A4_H });
      }

      const pdfBytes = await pdfDoc.save();
      let binary = "";
      const CHUNK = 8192;
      for (let i = 0; i < pdfBytes.length; i += CHUNK) {
        binary += String.fromCharCode(...pdfBytes.subarray(i, i + CHUNK));
      }
      const pdfBase64 = btoa(binary);
      const filename = `cours_${Date.now()}.pdf`;
      const tempPath = `${RNBlobUtil.fs.dirs.CacheDir}/${filename}`;
      await RNBlobUtil.fs.writeFile(tempPath, pdfBase64, "base64");

      setProgress("Préparation de l'envoi...");
      const signedRes = await apiFetch("/upload/userfiles/signed-url", {
        method: "POST",
        body: JSON.stringify({
          cardId: card._id,
          repertoire: card.repertoire,
          num: card.num,
          filename,
        }),
      });
      if (!signedRes.ok) {
        const err = await signedRes.json();
        throw new Error(err.error || "Erreur serveur");
      }
      const { signedUrl, publicUrl } = await signedRes.json();

      setProgress("Envoi du fichier...");
      const uploadRes = await RNBlobUtil.fetch(
        "PUT",
        signedUrl,
        { "Content-Type": "application/pdf" },
        RNBlobUtil.wrap(tempPath)
      );
      if (uploadRes.respInfo.status >= 400) throw new Error("Échec de l'envoi");
      await RNBlobUtil.fs.unlink(tempPath).catch(() => {});

      setProgress("Enregistrement...");
      const confirmRes = await apiFetch("/upload/userfiles/confirm", {
        method: "POST",
        body: JSON.stringify({
          cardId: card._id,
          filename,
          displayName: displayName.trim(),
        }),
      });
      if (!confirmRes.ok) throw new Error("Erreur d'enregistrement");

      onUploadComplete({
        name: displayName.trim(),
        filename,
        date: new Date().toISOString(),
        url: publicUrl,
      });
      reset();
      onClose();
    } catch (err: any) {
      setError(err.message || "Une erreur est survenue");
      setStep("error");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.bgdocuments }]}>
          <View style={[styles.header, { backgroundColor: colors.documents }]}>
            <AppText style={[styles.headerTitle, { color: colors.text }]}>
              {step === "naming"
                ? "Nom du fichier"
                : step === "scanning"
                ? `${scannedUris.length} page(s) scannée(s)`
                : "Traitement..."}
            </AppText>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={28} color={colors.text} />
            </TouchableOpacity>
          </View>

          {step === "naming" && (
            <View style={styles.body}>
              <AppText style={[styles.label, { color: colors.textSecondary }]}>
                Nom d'affichage dans la liste
              </AppText>
              <TextInput
                style={[styles.input, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.documents }]}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ex: Cours du 15 mai"
                placeholderTextColor={colors.muted as string}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={validateName}
              />
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.documents, opacity: displayName.trim() ? 1 : 0.4 }]}
                onPress={validateName}
                disabled={!displayName.trim()}
              >
                <AppText style={[styles.btnText, { color: colors.text }]}>Suivant →</AppText>
              </TouchableOpacity>
            </View>
          )}

          {step === "scanning" && (
            <View style={[styles.body, { gap: 0 }]}>
              {scannedUris.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ height: thumbHeight + 52, flexShrink: 0, flexGrow: 0 }}
                  contentContainerStyle={{ paddingRight: BODY_PADDING }}
                >
                  {scannedUris.map((uri, i) => (
                    <View key={i} style={[styles.thumbWrap, { width: thumbWidth, marginRight: THUMB_GAP }]}>
                      <Image source={{ uri }} style={{ width: thumbWidth, height: thumbHeight, borderRadius: 10 }} />
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removePage(i)}>
                        <Ionicons name="close-circle" size={26} color="#e74c3c" />
                      </TouchableOpacity>
                      <AppText style={[styles.thumbLabel, { color: colors.textSecondary }]}>
                        p.{i + 1}
                      </AppText>
                      <View style={styles.thumbArrows}>
                        <TouchableOpacity onPress={() => movePage(i, -1)} disabled={i === 0} hitSlop={8}>
                          <Ionicons name="chevron-back" size={22} color={i === 0 ? colors.muted as string : colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => movePage(i, 1)} disabled={i === scannedUris.length - 1} hitSlop={8}>
                          <Ionicons name="chevron-forward" size={22} color={i === scannedUris.length - 1 ? colors.muted as string : colors.text} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}

              <View style={styles.buttonsArea}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.documents }]}
                  onPress={startScan}
                >
                  <Ionicons name="scan-outline" size={22} color={colors.text} />
                  <AppText style={[styles.btnText, { color: colors.text }]}>
                    {scannedUris.length === 0 ? "Scanner des pages" : "Scanner d'autres pages"}
                  </AppText>
                </TouchableOpacity>

                {scannedUris.length > 0 && (
                  <TouchableOpacity style={[styles.btn, styles.btnSend]} onPress={buildAndUpload}>
                    <Ionicons name="cloud-upload-outline" size={22} color="#fff" />
                    <AppText style={[styles.btnText, { color: "#fff" }]}>
                      Créer et envoyer ({scannedUris.length} page{scannedUris.length > 1 ? "s" : ""})
                    </AppText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {step === "processing" && (
            <View style={[styles.body, styles.center]}>
              <ActivityIndicator size="large" color={colors.primary as string} />
              <AppText style={[styles.progressText, { color: colors.textSecondary }]}>
                {progress}
              </AppText>
            </View>
          )}

          {step === "error" && (
            <View style={[styles.body, styles.center]}>
              <Ionicons name="alert-circle-outline" size={48} color="#e74c3c" />
              <AppText style={[styles.errorText, { color: colors.text }]}>{error}</AppText>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: colors.documents }]}
                onPress={() => setStep("scanning")}
              >
                <AppText style={[styles.btnText, { color: colors.text }]}>Réessayer</AppText>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
  body: { flex: 1, margin:20,padding: 20, gap: 16 },
  center: { alignItems: "center", justifyContent: "center" },
  buttonsArea: { flex: 1, justifyContent: "center", gap: 16 },
  label: { fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, padding: 14, fontSize: 16 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  btnSend: { backgroundColor: "#2ecc71" },
  btnText: { fontSize: 16, fontWeight: "600" },
  thumbWrap: { alignItems: "center" },
  removeBtn: { position: "absolute", top: -1, right: -1 },
  thumbLabel: { fontSize: 12, marginTop: 4 },
  thumbArrows: { flexDirection: "row", gap: 10, marginTop: 4 },
  progressText: { fontSize: 16, marginTop: 16 },
  errorText: { fontSize: 15, textAlign: "center", marginVertical: 12 },
});
