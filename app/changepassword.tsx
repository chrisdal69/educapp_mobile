import { useMemo, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch, triggerUnauthorized } from "../utils/apiClient";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeColors } from "../theme";

const PASSWORD_RULES = [
  { key: "length", label: "Au moins 8 caractères", test: (p: string) => p.length >= 8 },
  { key: "upper",  label: "Une majuscule",         test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower",  label: "Une minuscule",         test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "Un chiffre",            test: (p: string) => /[0-9]/.test(p) },
  { key: "special",label: "Un caractère spécial",  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];
const STRENGTH_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#16a34a"];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [oldPassword, setOldPassword]         = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOld, setShowOld]       = useState(false);
  const [showNew, setShowNew]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);

  const rules    = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(newPassword) }));
  const strength = rules.filter((r) => r.ok).length;
  const isValid  = !!oldPassword && strength === 5 && newPassword === confirmPassword;

  async function handleSubmit() {
    setError(""); setSuccess(""); setRemainingAttempts(null); setLoading(true);
    try {
      const res  = await apiFetch("/users/change-password", {
        method: "POST",
        body: JSON.stringify({ oldPassword, newPassword }),
        skipUnauthorized: true,
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401 && typeof data.remainingAttempts === "number") {
          setRemainingAttempts(data.remainingAttempts);
          setError(data.message || data.error || "Ancien mot de passe incorrect.");
          return;
        }
        if (res.status === 401) {
          await triggerUnauthorized();
          return;
        }
        setError(data.message || data.error || "Erreur.");
        return;
      }
      setSuccess("Mot de passe changé avec succès ✅");
      setOldPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => router.back(), 2000);
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
        <Text style={styles.title}>Changer le mot de passe</Text>

        <View style={styles.card}>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {remainingAttempts !== null && (
            <Text style={styles.warning}>Tentatives restantes : {remainingAttempts}</Text>
          )}
          {success ? <Text style={styles.successMsg}>{success}</Text> : null}

          <Text style={styles.label}>Mot de passe actuel</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={oldPassword}
              onChangeText={setOldPassword}
              secureTextEntry={!showOld}
              placeholder="Mot de passe actuel"
              placeholderTextColor={colors.muted}
              editable={!loading}
              autoComplete="current-password"
            />
            <TouchableOpacity onPress={() => setShowOld((v) => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showOld ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.label, { marginTop: 14 }]}>Nouveau mot de passe</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={!showNew}
              placeholder="Nouveau mot de passe"
              placeholderTextColor={colors.muted}
              editable={!loading}
              autoComplete="new-password"
            />
            <TouchableOpacity onPress={() => setShowNew((v) => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showNew ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>

          {newPassword.length > 0 && (
            <View style={styles.rulesBox}>
              {rules.map((r) => (
                <Text key={r.key} style={[styles.rule, r.ok && styles.ruleOk]}>
                  {r.ok ? "✓" : "✗"} {r.label}
                </Text>
              ))}
              <View style={styles.strengthTrack}>
                <View style={[styles.strengthFill, {
                  width: `${strength * 20}%` as any,
                  backgroundColor: STRENGTH_COLORS[Math.max(0, strength - 1)],
                }]} />
              </View>
            </View>
          )}

          <Text style={[styles.label, { marginTop: 14 }]}>Confirmer</Text>
          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={!showConfirm}
              placeholder="Confirmation"
              placeholderTextColor={colors.muted}
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>
          {confirmPassword.length > 0 && newPassword !== confirmPassword && (
            <Text style={styles.error}>Les mots de passe ne correspondent pas</Text>
          )}

          <TouchableOpacity
            style={[styles.btn, { marginTop: 20 }, (!isValid || loading) && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading
              ? <ActivityIndicator color={colors.bg} />
              : <Text style={styles.btnText}>Changer le mot de passe</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
    backBtn: { marginBottom: 16 },
    backText: { color: c.primary, fontSize: 15 },
    title: { fontSize: 22, fontWeight: "bold", color: c.text, marginBottom: 20 },
    card: { backgroundColor: c.surface, borderRadius: 12, padding: 20 },
    label: { color: c.textSecondary, fontSize: 14, marginBottom: 6 },
    input: { backgroundColor: c.border, color: c.text, borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 16 },
    passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 8 },
    eyeBtn: { padding: 10 },
    eyeText: { fontSize: 18 },
    rulesBox: { marginBottom: 4 },
    rule: { color: c.muted, fontSize: 13, marginBottom: 2 },
    ruleOk: { color: "#22c55e" },
    strengthTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, marginTop: 8 },
    strengthFill: { height: 6, borderRadius: 3 },
    btn: { backgroundColor: c.primary, borderRadius: 8, padding: 16, alignItems: "center" },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: c.bg, fontSize: 16, fontWeight: "bold" },
    error: { color: "#ff6b6b", fontSize: 13, marginBottom: 8 },
    warning: { color: "#f97316", fontSize: 13, marginBottom: 8 },
    successMsg: { color: "#22c55e", fontSize: 14, textAlign: "center", marginBottom: 12 },
  });
}
