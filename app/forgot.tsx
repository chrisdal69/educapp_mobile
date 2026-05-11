import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import OtpInput from "../components/OtpInput";
import { API_URL } from "../utils/apiClient";

const CODE_TTL_MS = 7 * 60 * 1000;

const PASSWORD_RULES = [
  { key: "length", label: "Au moins 8 caractères", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "Une majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "Une minuscule", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "Un chiffre", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#16a34a"];

const STEPS = ["Email", "Code", "Mot de passe", "Succès"];

export default function ForgotScreen() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const passwordRules = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(newPassword) }));
  const strength = passwordRules.filter((r) => r.ok).length;
  const passwordsMatch = newPassword === confirmPassword;
  const isPasswordValid = strength === 5 && passwordsMatch;

  // Countdown timer
  useEffect(() => {
    if (step !== 2 || !codeExpiresAt) return;
    const interval = setInterval(
      () => setRemainingMs(Math.max(0, codeExpiresAt - Date.now())),
      1000
    );
    return () => clearInterval(interval);
  }, [step, codeExpiresAt]);

  // Auto-retour à l'étape 1 si code expiré
  useEffect(() => {
    if (step !== 2 || !codeExpiresAt) return;
    const delay = codeExpiresAt - Date.now();
    if (delay <= 0) return;
    const t = setTimeout(() => {
      setError("Code expiré. Recommencez.");
      setStep(1);
    }, delay);
    return () => clearTimeout(t);
  }, [step, codeExpiresAt]);

  const timerLabel = (() => {
    const s = Math.floor(remainingMs / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")} : ${String(s % 60).padStart(2, "0")}`;
  })();

  async function handleSendEmail() {
    setError(""); setInfo(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur."); return; }
      setCodeExpiresAt(Date.now() + CODE_TTL_MS);
      setRemainingMs(CODE_TTL_MS);
      setStep(2);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError(""); setInfo(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-forgot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur."); return; }
      setCode("");
      setCodeExpiresAt(Date.now() + CODE_TTL_MS);
      setRemainingMs(CODE_TTL_MS);
      setInfo("Nouveau code envoyé !");
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  function handleValidateCode() {
    if (code.length !== 4) return;
    setError(""); setInfo("");
    setStep(3);
  }

  async function handleResetPassword() {
    if (!isPasswordValid) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur."); return; }
      setStep(4);
      setTimeout(() => router.replace("/login" as any), 2000);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Mot de passe oublié</Text>

        {/* Barre de progression */}
        <View style={styles.stepsRow}>
          {STEPS.map((label, idx) => (
            <View key={idx} style={styles.stepItem}>
              <View style={[styles.stepCircle, step >= idx + 1 && styles.stepCircleActive]}>
                <Text style={[styles.stepNum, step >= idx + 1 && styles.stepNumActive]}>
                  {idx + 1}
                </Text>
              </View>
              <Text style={styles.stepLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        {/* Étape 1 — Email */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Réinitialiser le mot de passe</Text>
            <Text style={styles.label}>Adresse email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="votre@email.com"
              placeholderTextColor="#888"
              editable={!loading}
            />
            <TouchableOpacity
              style={[styles.btn, (!email.trim() || loading) && styles.btnDisabled]}
              onPress={handleSendEmail}
              disabled={!email.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color="#25292e" />
                : <Text style={styles.btnText}>Envoyer le code</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap}>
              <Text style={styles.link}>Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 2 — Code */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Saisir le code</Text>
            <Text style={styles.subtitle}>Code envoyé à {email}</Text>
            <OtpInput value={code} onChange={setCode} disabled={loading} />
            <Text style={styles.timer}>Temps restant : {timerLabel}</Text>
            <TouchableOpacity
              style={[styles.btn, (code.length !== 4 || loading) && styles.btnDisabled]}
              onPress={handleValidateCode}
              disabled={code.length !== 4 || loading}
            >
              <Text style={styles.btnText}>Valider le code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, loading && styles.btnDisabled]}
              onPress={handleResendCode}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#aaa" />
                : <Text style={styles.btnSecondaryText}>Renvoyer le code</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(1); setError(""); setInfo(""); setCode(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 3 — Nouveau mot de passe */}
        {step === 3 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Nouveau mot de passe</Text>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showPassword}
                placeholder="Nouveau mot de passe"
                placeholderTextColor="#888"
                editable={!loading}
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            {newPassword.length > 0 && (
              <View style={styles.rulesBox}>
                {passwordRules.map((r) => (
                  <Text key={r.key} style={[styles.rule, r.ok && styles.ruleOk]}>
                    {r.ok ? "✓" : "✗"} {r.label}
                  </Text>
                ))}
                <View style={styles.strengthTrack}>
                  <View
                    style={[
                      styles.strengthFill,
                      {
                        width: `${strength * 20}%` as any,
                        backgroundColor: STRENGTH_COLORS[Math.max(0, strength - 1)],
                      },
                    ]}
                  />
                </View>
              </View>
            )}

            <Text style={[styles.label, { marginTop: 12 }]}>Confirmer</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirm}
                placeholder="Confirmation"
                placeholderTextColor="#888"
                editable={!loading}
              />
              <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.error}>Les mots de passe ne correspondent pas</Text>
            )}

            <TouchableOpacity
              style={[styles.btn, { marginTop: 16 }, (!isPasswordValid || loading) && styles.btnDisabled]}
              onPress={handleResetPassword}
              disabled={!isPasswordValid || loading}
            >
              {loading
                ? <ActivityIndicator color="#25292e" />
                : <Text style={styles.btnText}>Changer le mot de passe</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(2); setError(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Étape 4 — Succès */}
        {step === 4 && (
          <View style={[styles.card, styles.centered]}>
            <Text style={styles.bigIcon}>✅</Text>
            <Text style={styles.cardTitle}>Mot de passe réinitialisé</Text>
            <Text style={styles.subtitle}>Redirection vers la connexion...</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e" },
  inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
  title: { fontSize: 26, fontWeight: "bold", color: "#ffd33d", textAlign: "center", marginBottom: 24 },
  stepsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  stepItem: { flex: 1, alignItems: "center" },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#444", alignItems: "center", justifyContent: "center",
  },
  stepCircleActive: { backgroundColor: "#ffd33d" },
  stepNum: { fontSize: 13, fontWeight: "bold", color: "#aaa" },
  stepNumActive: { color: "#25292e" },
  stepLabel: { fontSize: 10, color: "#aaa", marginTop: 4, textAlign: "center" },
  card: { backgroundColor: "#1e2227", borderRadius: 12, padding: 20 },
  centered: { alignItems: "center" },
  cardTitle: { fontSize: 18, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 16 },
  subtitle: { color: "#aaa", fontSize: 14, textAlign: "center", marginBottom: 16 },
  label: { color: "#ccc", fontSize: 14, marginBottom: 6 },
  input: {
    backgroundColor: "#333940", color: "#fff", borderRadius: 8,
    padding: 14, marginBottom: 14, fontSize: 16,
  },
  passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 8 },
  eyeBtn: { padding: 10 },
  eyeText: { fontSize: 18 },
  rulesBox: { marginBottom: 8 },
  rule: { color: "#888", fontSize: 13, marginBottom: 2 },
  ruleOk: { color: "#22c55e" },
  strengthTrack: { height: 6, backgroundColor: "#444", borderRadius: 3, marginTop: 8 },
  strengthFill: { height: 6, borderRadius: 3 },
  btn: {
    backgroundColor: "#ffd33d", borderRadius: 8, padding: 16,
    alignItems: "center", marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#25292e", fontSize: 16, fontWeight: "bold" },
  btnSecondary: {
    backgroundColor: "#333940", borderRadius: 8, padding: 14,
    alignItems: "center", marginTop: 10,
  },
  btnSecondaryText: { color: "#fff", fontSize: 15 },
  timer: { color: "#aaa", fontSize: 13, textAlign: "center", marginVertical: 12 },
  linkWrap: { alignItems: "center", marginTop: 16 },
  link: { color: "#ffd33d", fontSize: 14 },
  error: { color: "#ff6b6b", fontSize: 13, textAlign: "center", marginBottom: 8 },
  info: { color: "#22c55e", fontSize: 13, textAlign: "center", marginBottom: 8 },
  bigIcon: { fontSize: 48, marginBottom: 12 },
});
