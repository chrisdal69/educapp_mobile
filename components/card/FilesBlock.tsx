import { useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Linking } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { buildCardFileUrl } from "@/utils/gcsPaths";
import type { Card, CardHref } from "@/types/cards";
import PdfViewer from "@/components/card/PdfViewer";

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
    const full = hex.length === 3
      ? hex.split("").map((c) => c + c).join("")
      : hex;
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

  return (
    <View style={styles.wrapper}>
      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bgdocuments }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {files.map((f, index) => {
          const type = getFileType(f.href);
          const bg =
            index % 2 === 0
              ? withAlpha(colors.documents, 0.5)
              : colors.documents;
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

        <TouchableOpacity
          style={[styles.uploadBtn, { backgroundColor: withAlpha(colors.documents, 0.5) }]}
          activeOpacity={0.75}
          onPress={() => {}}
        >
          <AppText style={[styles.uploadText, { color: colors.text }]}>
            Upload cours manuscrit
          </AppText>
          <Ionicons name="camera-outline" size={28} color={colors.text} />
        </TouchableOpacity>
      </ScrollView>

      {pdfViewer && (
        <PdfViewer
          url={pdfViewer.url}
          title={pdfViewer.title}
          visible
          onClose={() => setPdfViewer(null)}
        />
      )}
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
    height: 80,
  },
  iconBox: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  info: { flex: 1   },
  name: { fontSize: 18, fontWeight: "600" },
  sub: { fontSize: 14, marginTop: 2 },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 14,
    padding: 16,
    marginTop: 4,
  },
  uploadText: { fontSize: 15, fontWeight: "500" },
});
