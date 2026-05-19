import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildCardFileUrl } from "@/utils/gcsPaths";
import { apiFetch } from "@/utils/apiClient";
import type { Card, CardHref, UserFileEntry } from "@/types/cards";
import PdfViewer from "@/components/card/PdfViewer";
import ManuscritUploader from "@/components/card/ManuscritUploader";

type Props = { card: Card; onClose: () => void };
type FileType = "pdf" | "py" | "video" | "image" | "doc" | "other";

function getFileType(href: string): FileType {
  const ext = href.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "py") return "py";
  if (["mp4", "mov", "avi", "mkv", "m4v"].includes(ext)) return "video";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["doc", "docx", "odt"].includes(ext)) return "doc";
  return "other";
}

function withAlpha(color: string, alpha: number): string {
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsla(").replace(")", `, ${alpha})`);
  }
  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

function FileIcon({ type }: { type: FileType }) {
  const { colors } = useTheme();
  switch (type) {
    case "pdf":
      return <MaterialCommunityIcons name="file-pdf-box" size={34} color="#e74c3c" />;
    case "py":
      return <MaterialCommunityIcons name="language-python" size={34} color="#3572A5" />;
    case "video":
      return <MaterialCommunityIcons name="file-video" size={34} color={colors.textSecondary} />;
    case "image":
      return <MaterialCommunityIcons name="file-image" size={34} color="#3498db" />;
    case "doc":
      return <MaterialCommunityIcons name="file-word" size={34} color="#2980b9" />;
    default:
      return <MaterialCommunityIcons name="file-document-outline" size={34} color={colors.textSecondary} />;
  }
}

export default function FilesBlock({ card }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [showUploader, setShowUploader] = useState(false);
  const [userFiles, setUserFiles] = useState<UserFileEntry[]>([]);
  const [renaming, setRenaming] = useState<UserFileEntry | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    fetchUserFiles();
  }, [card._id]);

  const fetchUserFiles = async () => {
    try {
      const res = await apiFetch(
        `/upload/userfiles?cardId=${card._id}&repertoire=${card.repertoire}&num=${card.num}`
      );
      if (res.ok) {
        const data = await res.json();
        setUserFiles(Array.isArray(data) ? data : (data.files ?? []));
      }
    } catch {
      // silently fail — list stays empty
    }
  };

  const files = (card.fichiers ?? []).filter((f) => f.visible !== false);

  const openFile = async (f: CardHref) => {
    if (!user?.directoryname) return;
    const url = buildCardFileUrl({
      directoryname: user.directoryname,
      repertoire: card.repertoire,
      num: card.num,
      filename: f.href,
    });
    if (!url) return;
    if (getFileType(f.href) === "pdf") {
      setPdfViewer({ url, title: f.txt ?? f.href });
    } else {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) Linking.openURL(url);
    }
  };

  const openUserFile = (f: UserFileEntry) => {
    setPdfViewer({ url: f.url, title: f.name });
  };

  const deleteUserFile = (f: UserFileEntry) => {
    Alert.alert("Supprimer", `Supprimer "${f.name}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch("/upload/userfiles", {
              method: "DELETE",
              body: JSON.stringify({
                cardId: card._id,
                filename: f.filename,
                repertoire: card.repertoire,
                num: card.num,
              }),
            });
            setUserFiles((prev) => prev.filter((u) => u.filename !== f.filename));
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer le fichier.");
          }
        },
      },
    ]);
  };

  const startRename = (f: UserFileEntry) => {
    setRenaming(f);
    setNewName(f.name);
  };

  const confirmRename = async () => {
    if (!renaming || !newName.trim()) return;
    try {
      await apiFetch("/upload/userfiles/rename", {
        method: "PATCH",
        body: JSON.stringify({
          cardId: card._id,
          filename: renaming.filename,
          newDisplayName: newName.trim(),
        }),
      });
      setUserFiles((prev) =>
        prev.map((u) => (u.filename === renaming.filename ? { ...u, name: newName.trim() } : u))
      );
    } catch {
      Alert.alert("Erreur", "Impossible de renommer le fichier.");
    }
    setRenaming(null);
    setNewName("");
  };

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bgdocuments }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Fichiers enseignant */}
        {files.map((f, index) => {
          const type = getFileType(f.href);
          const bg = index % 2 === 0 ? withAlpha(colors.documents, 0.5) : colors.documents;
          return (
            <TouchableOpacity
              key={`${f.href}-${index}`}
              style={[styles.item, { backgroundColor: bg }]}
              onPress={() => openFile(f)}
              activeOpacity={0.75}
            >
              <View style={styles.iconBox}>
                <FileIcon type={type} />
              </View>
              <View style={styles.info}>
                <AppText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {f.txt}
                </AppText>
                {!!f.hover && (
                  <AppText style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
                    {f.hover}
                  </AppText>
                )}
              </View>
              <Ionicons name="arrow-forward" size={40} color={colors.text} />
            </TouchableOpacity>
          );
        })}

        {/* Fichiers élève */}
        {userFiles.map((f, index) => {
          const bg = (files.length + index) % 2 === 0
            ? withAlpha(colors.documents, 0.5)
            : colors.documents;
          return (
            <TouchableOpacity
              key={f.filename}
              style={[styles.item, { backgroundColor: bg }]}
              onPress={() => openUserFile(f)}
              activeOpacity={0.75}
            >
              <View style={styles.iconBox}>
                <MaterialCommunityIcons name="file-pdf-box" size={34} color="#e74c3c" />
              </View>
              <View style={styles.info}>
                <AppText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {f.name}
                </AppText>
                <AppText style={[styles.sub, { color: colors.textSecondary }]}>Mon fichier</AppText>
              </View>
              <View style={styles.userFileActions}>
                <TouchableOpacity onPress={() => startRename(f)} hitSlop={8}>
                  <Ionicons name="pencil-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteUserFile(f)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={24} color="#e74c3c" />
                </TouchableOpacity>
                <Ionicons name="person-outline" size={24} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Bouton upload — visible uniquement si quota autorisé et non atteint */}
        {(card.nbUserFiles ?? 0) > 0 && userFiles.length < (card.nbUserFiles ?? 0) && (
          <TouchableOpacity
            style={[styles.uploadBtn, {
              backgroundColor: (files.length + userFiles.length) % 2 === 0
                ? withAlpha(colors.documents, 0.5)
                : colors.documents,
            }]}
            activeOpacity={0.75}
            onPress={() => setShowUploader(true)}
          >
            <AppText style={[styles.uploadText, { color: colors.text }]}>
              Upload cours manuscrit
            </AppText>
            <Ionicons name="camera-outline" size={28} color={colors.text} />
          </TouchableOpacity>
        )}
      </ScrollView>

      {pdfViewer && (
        <PdfViewer
          url={pdfViewer.url}
          title={pdfViewer.title}
          visible
          onClose={() => setPdfViewer(null)}
        />
      )}

      <ManuscritUploader
        card={card}
        visible={showUploader}
        onClose={() => setShowUploader(false)}
        onUploadComplete={(file) => setUserFiles((prev) => [...prev, file])}
      />

      {/* Modal renommage */}
      <Modal visible={!!renaming} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <View style={styles.renameOverlay}>
          <View style={[styles.renameBox, { backgroundColor: colors.bgdocuments }]}>
            <AppText style={[styles.renameTitle, { color: colors.text }]}>Renommer</AppText>
            <TextInput
              style={[styles.renameInput, { backgroundColor: colors.bg, color: colors.text, borderColor: colors.documents }]}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmRename}
            />
            <View style={styles.renameActions}>
              <TouchableOpacity onPress={() => setRenaming(null)} style={styles.renameBtn}>
                <AppText style={{ color: colors.textSecondary }}>Annuler</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRename}
                style={[styles.renameBtn, { backgroundColor: colors.documents, borderRadius: 8 }]}
              >
                <AppText style={{ color: colors.text, fontWeight: "600" }}>OK</AppText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1 },
  scroll: { flex: 1, marginTop: 12 },
  content: { padding: 12, gap: 30 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    minHeight: 80,
  },
  iconBox: { width: 36, alignItems: "center", justifyContent: "center" },
  info: { flex: 1 },
  name: { fontSize: 18, fontWeight: "600" },
  sub: { fontSize: 14, marginTop: 2 },
  userFileActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
    height: 75,
  },
  uploadText: { fontSize: 15, fontWeight: "600" },
  renameOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  renameBox: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  renameTitle: { fontSize: 18, fontWeight: "700" },
  renameInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  renameActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  renameBtn: { padding: 10, paddingHorizontal: 16 },
});
