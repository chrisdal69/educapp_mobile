import { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Platform,
  Linking,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/utils/apiClient";
import PdfViewer from "@/components/card/PdfViewer";
import ManuscritUploader from "@/components/card/ManuscritUploader";
import type { Card } from "@/types/cards";

type Props = { card: Card; onClose: () => void };

type CloudMessage = {
  _id: string;
  filename: string;
  date: string;
  message: string;
};

type CloudFile = {
  name: string;
  url: string;
};

type FileType = "pdf" | "py" | "image" | "doc" | "other";

function getFileType(name: string): FileType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "pdf";
  if (ext === "py") return "py";
  if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) return "image";
  if (["doc", "docx", "odt"].includes(ext)) return "doc";
  return "other";
}

function FileIcon({ type, color }: { type: FileType; color: string }) {
  switch (type) {
    case "pdf":
      return <MaterialCommunityIcons name="file-pdf-box" size={30} color="#e74c3c" />;
    case "py":
      return <MaterialCommunityIcons name="language-python" size={30} color="#3572A5" />;
    case "image":
      return <MaterialCommunityIcons name="file-image" size={30} color="#3498db" />;
    case "doc":
      return <MaterialCommunityIcons name="file-word" size={30} color="#2980b9" />;
    default:
      return <MaterialCommunityIcons name="file-document-outline" size={30} color={color} />;
  }
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

function stripPrefix(name: string): string {
  const parts = name.split("___");
  if (parts.length <= 1) return name;
  const withoutUserPrefix = parts.slice(1).join("___");
  // Retirer aussi le marqueur scan___ ajouté par l'upload mobile
  if (withoutUserPrefix.startsWith("scan___")) {
    return withoutUserPrefix.slice("scan___".length);
  }
  return withoutUserPrefix;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = d.getDate().toString().padStart(2, "0");
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export default function CloudBlock({ card }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [messages, setMessages] = useState<CloudMessage[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [pdfViewer, setPdfViewer] = useState<{ url: string; title: string } | null>(null);
  const [renaming, setRenaming] = useState<CloudFile | null>(null);
  const [newName, setNewName] = useState("");
  const [renameExt, setRenameExt] = useState("");

  useEffect(() => {
    fetchAll();
  }, [card._id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchMessages(), fetchFiles()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await apiFetch(`/cards/cloud?id_card=${card._id}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.result ?? []);
      }
    } catch {
      // silently fail
    }
  };

  const fetchFiles = async () => {
    try {
      const res = await apiFetch("/upload/recup", {
        method: "POST",
        body: JSON.stringify({
          parent: "cloud",
          repertoire: card.repertoire,
          num: card.num,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFiles(Array.isArray(data) ? data : []);
      }
    } catch {
      // silently fail
    }
  };

  const deleteMessage = (msg: CloudMessage) => {
    Alert.alert("Supprimer", "Supprimer ce message ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch(`/cards/cloud/${msg._id}`, { method: "DELETE" });
            setMessages((prev) => prev.filter((m) => m._id !== msg._id));
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer le message.");
          }
        },
      },
    ]);
  };

  const openFile = async (file: CloudFile) => {
    const basename = file.name.split("/").pop() ?? "";
    if (getFileType(basename) === "pdf") {
      setPdfViewer({ url: file.url, title: stripPrefix(basename) });
    } else {
      const canOpen = await Linking.canOpenURL(file.url);
      if (canOpen) Linking.openURL(file.url);
    }
  };

  const deleteFile = (file: CloudFile) => {
    const basename = file.name.split("/").pop() ?? "";
    Alert.alert("Supprimer", `Supprimer "${stripPrefix(basename)}" ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await apiFetch("/upload/delete", {
              method: "POST",
              body: JSON.stringify({
                parent: "cloud",
                file: basename,
                repertoire: card.repertoire,
                num: card.num,
              }),
            });
            setFiles((prev) => prev.filter((f) => f.name !== file.name));
          } catch {
            Alert.alert("Erreur", "Impossible de supprimer le fichier.");
          }
        },
      },
    ]);
  };

  const startRename = (file: CloudFile) => {
    const basename = file.name.split("/").pop() ?? "";
    const display = stripPrefix(basename);
    const lastDot = display.lastIndexOf(".");
    if (lastDot !== -1) {
      setNewName(display.slice(0, lastDot));
      setRenameExt(display.slice(lastDot));
    } else {
      setNewName(display);
      setRenameExt("");
    }
    setRenaming(file);
  };

  const confirmRename = async () => {
    if (!renaming || !newName.trim()) return;
    const basename = renaming.name.split("/").pop() ?? "";
    const finalName = `${newName.trim()}${renameExt}`;
    try {
      await apiFetch("/upload/rename", {
        method: "POST",
        body: JSON.stringify({
          parent: "cloud",
          oldName: basename,
          newName: finalName,
          repertoire: card.repertoire,
          num: card.num,
        }),
      });
      await fetchFiles();
    } catch {
      Alert.alert("Erreur", "Impossible de renommer le fichier.");
    }
    setRenaming(null);
    setNewName("");
    setRenameExt("");
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgcloud }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Messages enseignant */}
        {messages.length > 0 && (
          <View style={[styles.messagesBlock, { borderColor: colors.cloud }]}>
            {messages.map((msg, i) => (
              <View
                key={msg._id}
                style={[
                  styles.messageItem,
                  i < messages.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.cloud },
                ]}
              >
                <View style={styles.messageContent}>
                  <AppText style={[styles.messageFilename, { color: colors.text }]}>
                    @{msg.filename}
                  </AppText>
                  <AppText style={[styles.messageDate, { color: colors.textSecondary }]}>
                    {formatDate(msg.date)}
                  </AppText>
                  <AppText style={[styles.messageText, { color: colors.text }]}>
                    {msg.message}
                  </AppText>
                </View>
                <TouchableOpacity onPress={() => deleteMessage(msg)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Fichiers GCS */}
        {files.map((file, index) => {
          const basename = file.name.split("/").pop() ?? "";
          const displayName = stripPrefix(basename);
          const type = getFileType(basename);
          const bg = index % 2 === 0
            ? withAlpha(colors.cloud, 0.5)
            : colors.cloud;

          return (
            <TouchableOpacity
              key={file.name}
              style={[styles.fileItem, { backgroundColor: bg }]}
              onPress={() => openFile(file)}
              activeOpacity={0.75}
            >
              <View style={styles.fileIcon}>
                <FileIcon type={type} color={colors.textSecondary as string} />
              </View>
              <AppText style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                {displayName}
              </AppText>
              <View style={styles.fileActions}>
                <TouchableOpacity onPress={() => openFile(file)} hitSlop={6}>
                  <Ionicons name="arrow-forward" size={24} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => startRename(file)} hitSlop={6}>
                  <Ionicons name="pencil-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteFile(file)} hitSlop={6}>
                  <Ionicons name="trash-outline" size={22} color="#e74c3c" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Bouton Nouveau fichier — visible si quota autorisé et non atteint */}
        {(card.nbCloudFiles ?? 0) > 0 &&
          files.filter((f) => (f.name.split("/").pop() ?? "").includes("___scan___")).length < (card.nbCloudFiles ?? 0) && (
          <TouchableOpacity
            style={[
              styles.fileItem,
              {
                backgroundColor: files.length % 2 === 0
                  ? withAlpha(colors.cloud, 0.5)
                  : colors.cloud,
              },
            ]}
            activeOpacity={0.75}
            onPress={() => setShowUploader(true)}
          >
            <AppText style={[styles.fileName, { color: colors.text }]}>
              Upload document scanné
            </AppText>
            <Ionicons name="camera-outline" size={26} color={colors.text} />
          </TouchableOpacity>
        )}
      </ScrollView>

      <ManuscritUploader
        card={card}
        visible={showUploader}
        uploadMode="cloud"
        onClose={() => setShowUploader(false)}
        onUploadDone={async () => { await fetchFiles(); setShowUploader(false); }}
      />

      {pdfViewer && (
        <PdfViewer
          url={pdfViewer.url}
          title={pdfViewer.title}
          visible
          onClose={() => setPdfViewer(null)}
        />
      )}

      {/* Modal renommage */}
      <Modal
        visible={!!renaming}
        transparent
        animationType="fade"
        onRequestClose={() => setRenaming(null)}
      >
        <View style={styles.renameOverlay}>
          <View style={[styles.renameBox, { backgroundColor: colors.bgcloud }]}>
            <AppText style={[styles.renameTitle, { color: colors.text }]}>Renommer</AppText>
            <View style={styles.renameInputRow}>
              <TextInput
                style={[styles.renameInput, { flex: 1, backgroundColor: colors.bg, color: colors.text, borderColor: colors.cloud }]}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={confirmRename}
              />
              {!!renameExt && (
                <AppText style={[styles.renameExtLabel, { color: colors.muted as string }]}>
                  {renameExt}
                </AppText>
              )}
            </View>
            <View style={styles.renameActions}>
              <TouchableOpacity onPress={() => setRenaming(null)} style={styles.renameBtn}>
                <AppText style={{ color: colors.textSecondary }}>Annuler</AppText>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmRename}
                style={[styles.renameBtn, { backgroundColor: colors.cloud, borderRadius: 8 }]}
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
  container: { flex: 1 },
  scroll: { flex: 1 },
  content: { marginTop: 12, padding: 12, gap: 12 },
  messagesBlock: {
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
  },
  messageItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
    margin:0
  },
  messageContent: { flex: 1, gap: 2 },
  messageFilename: { fontSize: 15, fontWeight: "700" },
  messageDate: { fontSize: 12 },
  messageText: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  fileItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    minHeight: 80,
    margin: 5,
  },
  fileIcon: { width: 32, alignItems: "center" },
  fileName: { flex: 1, fontSize: 16, fontWeight: "500" },
  fileActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  renameOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  renameBox: { width: "100%", borderRadius: 16, padding: 20, gap: 14 },
  renameTitle: { fontSize: 18, fontWeight: "700" },
  renameInputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  renameInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 16 },
  renameExtLabel: { fontSize: 16, fontWeight: "500" },
  renameActions: { flexDirection: "row", justifyContent: "flex-end", gap: 12 },
  renameBtn: { padding: 10, paddingHorizontal: 16 },
});
