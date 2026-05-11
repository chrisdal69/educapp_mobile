import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "../utils/apiClient";
import { useAuth } from "../contexts/AuthContext";

const CONFIRM_PHRASE = "JE VEUX SUPPRIMER MON COMPTE MATHSAPP";

export default function DeleteAccountScreen() {
  const router      = useRouter();
  const { logout }  = useAuth();
  const [confirmText, setConfirmText] = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const isReady = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  async function handleDelete() {
    setError(""); setLoading(true);
    try {
      const res  = await apiFetch("/users/delete-account", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Erreur."); return; }
      await logout();
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.inner}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Supprimer le compte</Text>

        <View style={styles.card}>
          <Text style={styles.warningIcon}>🗑️</Text>
          <Text style={styles.warningText}>
            Cette action est <Text style={styles.bold}>définitive et irréversible</Text>.
            Votre compte, vos données et tous les fichiers uploadés seront supprimés.
          </Text>

          <Text style={styles.label}>
            Pour confirmer, saisissez exactement :
          </Text>
          <Text style={styles.phrase}>{CONFIRM_PHRASE}</Text>

          <TextInput
            style={styles.input}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Saisissez la phrase ci-dessus"
            placeholderTextColor="#888"
            editable={!loading}
            autoCapitalize="characters"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btn, (!isReady || loading) && styles.btnDisabled]}
            onPress={handleDelete}
            disabled={!isReady || loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.btnText}>Supprimer définitivement</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e" },
  inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
  backBtn: { marginBottom: 16 },
  backText: { color: "#ffd33d", fontSize: 15 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 20 },
  card: { backgroundColor: "#1e2227", borderRadius: 12, padding: 20 },
  warningIcon: { fontSize: 36, textAlign: "center", marginBottom: 12 },
  warningText: { color: "#aaa", fontSize: 14, lineHeight: 20, marginBottom: 20, textAlign: "center" },
  bold: { color: "#ff6b6b", fontWeight: "bold" },
  label: { color: "#ccc", fontSize: 14, marginBottom: 8 },
  phrase: {
    color: "#ffd33d", fontSize: 13, fontWeight: "bold",
    backgroundColor: "#2a2f35", padding: 10, borderRadius: 6,
    marginBottom: 14, textAlign: "center",
  },
  input: { backgroundColor: "#333940", color: "#fff", borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 15 },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 10 },
  btn: { backgroundColor: "#dc2626", borderRadius: 8, padding: 16, alignItems: "center" },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
