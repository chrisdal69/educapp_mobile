import { useState } from "react";
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import Pdf from "react-native-pdf";
import Ionicons from "@expo/vector-icons/Ionicons";
import AppText from "@/components/AppText";
import { useTheme } from "@/contexts/ThemeContext";

type Props = {
  url: string;
  title: string;
  visible: boolean;
  onClose: () => void;
};

export default function PdfViewer({ url, title, visible, onClose }: Props) {
  const { colors } = useTheme();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState(false);

  const source = { uri: url, cache: true };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.header, { backgroundColor: colors.documents }]}>
          <View style={styles.headerText}>
            <AppText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </AppText>
            {totalPages > 0 && (
              <AppText style={[styles.pages, { color: colors.textSecondary }]}>
                {page} / {totalPages}
              </AppText>
            )}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={30} color={colors.text} />
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.center}>
            <Ionicons name="alert-circle-outline" size={48} color={colors.muted} />
            <AppText style={[styles.errorText, { color: colors.muted }]}>
              Impossible d'ouvrir ce fichier
            </AppText>
          </View>
        ) : (
          <Pdf
            source={source}
            style={styles.pdf}
            onLoadComplete={(pages) => setTotalPages(pages)}
            onPageChanged={(p) => setPage(p)}
            onError={() => setError(true)}
            renderActivityIndicator={() => (
              <ActivityIndicator size="large" color={colors.primary} />
            )}
            enablePaging={false}
            trustAllCerts={false}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === "ios" ? 50 : 0 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    paddingTop: 20,
  },
  headerText: { flex: 1, marginRight: 12 },
  title: { fontSize: 17, fontWeight: "600" },
  pages: { fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  pdf: { flex: 1, width: "100%" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 16 },
});
