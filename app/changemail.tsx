import { useEffect, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useRouter } from "expo-router";
import OtpInput from "../components/OtpInput";
import { apiFetch } from "../utils/apiClient";
import { useAuth } from "../contexts/AuthContext";

export default function ChangeMailScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [step, setStep]           = useState(1);
  const [newEmail, setNewEmail]   = useState("");
  const [password, setPassword]   = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode]           = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [error, setError]         = useState("");
  const [info, setInfo]           = useState("");
  const [loading, setLoading]     = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  // Countdown
  useEffect(() => {
    if (step !== 2 || !expiresAt) return;
    const interval = setInterval(
      () => setRemainingMs(Math.max(0, expiresAt - Date.now())),
      1000
    );
    return () => clearInterval(interval);
  }, [step, expiresAt]);

  useEffect(() => {
    if (step !== 2 || !expiresAt) return;
    const delay = expiresAt - Date.now();
    if (delay <= 0) return;
    const t = setTimeout(() => {
      setError("Code expiré. Recommencez.");
      setStep(1);
    }, delay);
    return () => clearTimeout(t);
  }, [step, expiresAt]);

  const timerLabel = (() => {
    const s = Math.floor(remainingMs / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")} : ${String(s % 60).padStart(2, "0")}`;
  })();

  async function handleRequest() {
    setError(""); setInfo(""); setRemainingAttempts(null); setLoading(true);
    try {
      const res  = await apiFetch("/users/change-email/request", {
        method: "POST",
        body: JSON.stringify({ password, newEmail: newEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Erreur."); return; }
      setPendingEmail(data.pendingEmail ?? newEmail.trim());
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 7 * 60 * 1000);
      setRemainingMs(data.expiresAt
        ? Math.max(0, new Date(data.expiresAt).getTime() - Date.now())
        : 7 * 60 * 1000);
      setCode("");
      setStep(2);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(""); setRemainingAttempts(null); setLoading(true);
    try {
      const res  = await apiFetch("/users/change-email/verify", {
        method: "POST",
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.remainingAttempts === "number") {
          setRemainingAttempts(data.remainingAttempts);
        }
        setError(data.message || data.error || "Code invalide.");
        return;
      }
      setInfo(`Email changé en ${pendingEmail} ✅`);
      setTimeout(() => router.back(), 1500);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError(""); setInfo(""); setLoading(true);
    try {
      const res  = await apiFetch("/users/change-email/resend", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Erreur."); return; }
      setCode("");
      setExpiresAt(data.expiresAt ? new Date(data.expiresAt).getTime() : Date.now() + 7 * 60 * 1000);
      setRemainingMs(7 * 60 * 1000);
      setInfo("Nouveau code envoyé !");
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
        <Text style={styles.title}>Changer l'email</Text>
        {user?.email ? <Text style={styles.currentEmail}>Actuel : {user.email}</Text> : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info  ? <Text style={styles.successMsg}>{info}</Text> : null}

        {/* Étape 1 */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.label}>Nouvel email</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="nouveau@email.com"
              placeholderTextColor="#888"
              editable={!loading}
            />
            <Text style={styles.label}>Mot de passe actuel</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Mot de passe"
                placeholderTextColor="#888"
                editable={!loading}
                autoComplete="current-password"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.btn, { marginTop: 20 }, (!newEmail.trim() || !password || loading) && styles.btnDisabled]}
              onPress={handleRequest}
              disabled={!newEmail.trim() || !password || loading}
            >
              {loading
                ? <ActivityIndicator color="#25292e" />
                : <Text style={styles.btnText}>Envoyer le code</Text>}
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 2 */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vérification</Text>
            <Text style={styles.subtitle}>Code envoyé à {pendingEmail}</Text>
            <OtpInput value={code} onChange={setCode} disabled={loading} caseTransform="none" />
            <Text style={styles.timer}>Temps restant : {timerLabel}</Text>
            {remainingAttempts !== null && (
              <Text style={styles.warning}>Tentatives restantes : {remainingAttempts}</Text>
            )}
            <TouchableOpacity
              style={[styles.btn, (code.length !== 4 || loading) && styles.btnDisabled]}
              onPress={handleVerify}
              disabled={code.length !== 4 || loading}
            >
              {loading
                ? <ActivityIndicator color="#25292e" />
                : <Text style={styles.btnText}>Valider</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, loading && styles.btnDisabled]}
              onPress={handleResend}
              disabled={loading}
            >
              <Text style={styles.btnSecondaryText}>Renvoyer le code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(1); setError(""); setInfo(""); setCode(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Modifier l'email</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e" },
  inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
  backBtn: { marginBottom: 16 },
  backText: { color: "#ffd33d", fontSize: 15 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", marginBottom: 4 },
  currentEmail: { color: "#888", fontSize: 13, marginBottom: 20 },
  card: { backgroundColor: "#1e2227", borderRadius: 12, padding: 20 },
  cardTitle: { fontSize: 17, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 8 },
  subtitle: { color: "#aaa", fontSize: 13, textAlign: "center", marginBottom: 16 },
  label: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  input: { backgroundColor: "#333940", color: "#fff", borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 16 },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 0, gap: 8 },
  eyeBtn: { padding: 10 },
  eyeText: { fontSize: 18 },
  btn: { backgroundColor: "#ffd33d", borderRadius: 8, padding: 16, alignItems: "center", marginTop: 4 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#25292e", fontSize: 16, fontWeight: "bold" },
  btnSecondary: { backgroundColor: "#333940", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 10 },
  btnSecondaryText: { color: "#fff", fontSize: 15 },
  timer: { color: "#aaa", fontSize: 13, textAlign: "center", marginVertical: 12 },
  linkWrap: { alignItems: "center", marginTop: 16 },
  link: { color: "#ffd33d", fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 13, marginBottom: 12 },
  warning: { color: "#f97316", fontSize: 13, textAlign: "center", marginBottom: 8 },
  successMsg: { color: "#22c55e", fontSize: 14, textAlign: "center", marginBottom: 12 },
});
