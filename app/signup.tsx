import { useEffect, useMemo, useState } from "react";
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
import { useTheme } from "../contexts/ThemeContext";
import { ThemeColors } from "../theme";

const CODE_TTL_MS = 7 * 60 * 1000;

const PASSWORD_RULES = [
  { key: "length", label: "Au moins 8 caractères", test: (p: string) => p.length >= 8 },
  { key: "upper", label: "Une majuscule", test: (p: string) => /[A-Z]/.test(p) },
  { key: "lower", label: "Une minuscule", test: (p: string) => /[a-z]/.test(p) },
  { key: "number", label: "Un chiffre", test: (p: string) => /[0-9]/.test(p) },
  { key: "special", label: "Un caractère spécial", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

const STRENGTH_COLORS = ["#dc2626", "#f97316", "#eab308", "#22c55e", "#16a34a"];

const STEPS = ["Code prof.", "Identité", "Mot de passe", "Vérif.", "Succès"];

type Student = { nom: string; prenom: string; free?: boolean; id_user?: string | null };

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  // Étape 1
  const [teacherCode, setTeacherCode] = useState("");
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<Student[]>([]);

  // Étape 2
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [showNomSuggestions, setShowNomSuggestions] = useState(false);
  const [showPrenomSuggestions, setShowPrenomSuggestions] = useState(false);
  const [emailExists, setEmailExists] = useState(false);

  // Étape 3
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Étape 4
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationExpiresAt, setVerificationExpiresAt] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  const passwordRules = PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(password) }));
  const strength = passwordRules.filter((r) => r.ok).length;
  const passwordsMatch = password === confirmPassword;
  const isPasswordValid = strength === 5 && passwordsMatch;

  // Countdown
  useEffect(() => {
    if (step !== 4 || !verificationExpiresAt) return;
    const interval = setInterval(
      () => setRemainingMs(Math.max(0, verificationExpiresAt - Date.now())),
      1000
    );
    return () => clearInterval(interval);
  }, [step, verificationExpiresAt]);

  useEffect(() => {
    if (step !== 4 || !verificationExpiresAt) return;
    const delay = verificationExpiresAt - Date.now();
    if (delay <= 0) return;
    const t = setTimeout(() => {
      setError("Code expiré. Recommencez l'inscription.");
      setStep(1);
    }, delay);
    return () => clearTimeout(t);
  }, [step, verificationExpiresAt]);

  const timerLabel = (() => {
    const s = Math.floor(remainingMs / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")} : ${String(s % 60).padStart(2, "0")}`;
  })();

  // Suggestions nom/prenom
  const availableStudents = useMemo(
    () => students.filter((s) => s.free !== false && s.id_user == null),
    [students]
  );

  const nomSuggestions = useMemo(() => {
    if (!nom.trim()) return availableStudents.slice(0, 6);
    return availableStudents
      .filter((s) => s.nom?.toLowerCase().includes(nom.toLowerCase()))
      .slice(0, 6);
  }, [availableStudents, nom]);

  const prenomSuggestions = useMemo(() => {
    if (!prenom.trim()) return availableStudents.slice(0, 6);
    return availableStudents
      .filter((s) => s.prenom?.toLowerCase().includes(prenom.toLowerCase()))
      .slice(0, 6);
  }, [availableStudents, prenom]);

  function fillFromStudent(s: Student) {
    setNom(s.nom ?? "");
    setPrenom(s.prenom ?? "");
    setShowNomSuggestions(false);
    setShowPrenomSuggestions(false);
  }

  // ── Étape 1 : valider code professeur ──────────────────────────────────────
  async function handleValidateTeacherCode() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup/validate-teacher-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: teacherCode }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Code invalide."); return; }
      setClassId(data.classId);
      setStudents(data.students ?? []);
      setStep(2);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 2 : vérifier identité ────────────────────────────────────────────
  async function handleCheckIdentity() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup/check-student`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, nom, prenom, email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || data.error || "Erreur."); return; }
      setEmailExists(!!data.emailExists);
      setPassword(""); setConfirmPassword("");
      setStep(3);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 3a : créer un nouveau compte ─────────────────────────────────────
  async function handleCreateAccount() {
    if (!isPasswordValid) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, nom, prenom, email, password, confirmPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || data.message || "Erreur."); return; }
      setVerificationCode("");
      setVerificationExpiresAt(Date.now() + CODE_TTL_MS);
      setRemainingMs(CODE_TTL_MS);
      setInfo("Un code a été envoyé à votre email.");
      setStep(4);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 3b : rejoindre avec compte existant ──────────────────────────────
  async function handleJoinExisting() {
    if (!password) return;
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup/join-existing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId, nom, prenom, email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setStep(5);
      setTimeout(() => router.replace("/login" as any), 2000);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  // ── Étape 4 : vérifier email ───────────────────────────────────────────────
  async function handleVerifyCode() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/verifmail`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: verificationCode.trim().toUpperCase(), classId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Code invalide."); return; }
      setStep(5);
      setTimeout(() => router.replace("/login" as any), 2000);
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResendCode() {
    setError(""); setInfo(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/resend-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Erreur."); return; }
      setVerificationCode("");
      setVerificationExpiresAt(Date.now() + CODE_TTL_MS);
      setRemainingMs(CODE_TTL_MS);
      setInfo("Nouveau code envoyé !");
    } catch {
      setError("Impossible de joindre le serveur.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCancelSignup() {
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/signup/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      router.replace("/login" as any);
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
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Inscription</Text>

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

        {/* ── Étape 1 : code professeur ── */}
        {step === 1 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Code professeur</Text>
            <Text style={styles.subtitle}>Saisir le code à 4 caractères fourni par votre professeur</Text>
            <OtpInput
              value={teacherCode}
              onChange={setTeacherCode}
              disabled={loading}
              caseTransform="none"
            />
            <TouchableOpacity
              style={[styles.btn, (teacherCode.length !== 4 || loading) && styles.btnDisabled]}
              onPress={handleValidateTeacherCode}
              disabled={teacherCode.length !== 4 || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Valider</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap}>
              <Text style={styles.link}>Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape 2 : identité ── */}
        {step === 2 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Identité</Text>

            <Text style={styles.label}>Nom</Text>
            <TextInput
              style={styles.input}
              value={nom}
              onChangeText={(t) => { setNom(t); setShowNomSuggestions(true); }}
              onFocus={() => setShowNomSuggestions(true)}
              onBlur={() => setTimeout(() => setShowNomSuggestions(false), 200)}
              placeholder="Votre nom"
              placeholderTextColor={colors.muted}
              editable={!loading}
              autoCapitalize="words"
            />
            {showNomSuggestions && nomSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {nomSuggestions.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestion} onPress={() => fillFromStudent(s)}>
                    <Text style={styles.suggestionText}>{s.nom} {s.prenom}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Prénom</Text>
            <TextInput
              style={styles.input}
              value={prenom}
              onChangeText={(t) => { setPrenom(t); setShowPrenomSuggestions(true); }}
              onFocus={() => setShowPrenomSuggestions(true)}
              onBlur={() => setTimeout(() => setShowPrenomSuggestions(false), 200)}
              placeholder="Votre prénom"
              placeholderTextColor={colors.muted}
              editable={!loading}
              autoCapitalize="words"
            />
            {showPrenomSuggestions && prenomSuggestions.length > 0 && (
              <View style={styles.suggestions}>
                {prenomSuggestions.map((s, i) => (
                  <TouchableOpacity key={i} style={styles.suggestion} onPress={() => fillFromStudent(s)}>
                    <Text style={styles.suggestionText}>{s.prenom} ({s.nom})</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              placeholder="votre@email.com"
              placeholderTextColor={colors.muted}
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.btn, (!nom.trim() || !prenom.trim() || !email.trim() || loading) && styles.btnDisabled]}
              onPress={handleCheckIdentity}
              disabled={!nom.trim() || !prenom.trim() || !email.trim() || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Valider</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(1); setError(""); setInfo(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape 3a : nouveau compte ── */}
        {step === 3 && !emailExists && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Créer un mot de passe</Text>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Mot de passe"
                placeholderTextColor={colors.muted}
                editable={!loading}
                autoComplete="new-password"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
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
                placeholderTextColor={colors.muted}
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
              onPress={handleCreateAccount}
              disabled={!isPasswordValid || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>S'inscrire</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(2); setError(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape 3b : compte existant ── */}
        {step === 3 && emailExists && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Connexion</Text>
            <Text style={styles.subtitle}>
              Cet email est déjà enregistré. Saisissez votre mot de passe pour rejoindre la classe.
            </Text>

            <Text style={styles.label}>Mot de passe</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="Mot de passe"
                placeholderTextColor={colors.muted}
                editable={!loading}
                autoComplete="current-password"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.btn, { marginTop: 16 }, (!password || loading) && styles.btnDisabled]}
              onPress={handleJoinExisting}
              disabled={!password || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Se connecter</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setStep(2); setError(""); }}
              style={styles.linkWrap}
            >
              <Text style={styles.link}>← Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape 4 : vérification email ── */}
        {step === 4 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Vérification email</Text>
            <Text style={styles.subtitle}>Code envoyé à {email}</Text>
            <OtpInput
              value={verificationCode}
              onChange={setVerificationCode}
              disabled={loading}
            />
            <Text style={styles.timer}>Temps restant : {timerLabel}</Text>

            <TouchableOpacity
              style={[styles.btn, (verificationCode.length !== 4 || loading) && styles.btnDisabled]}
              onPress={handleVerifyCode}
              disabled={verificationCode.length !== 4 || loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Valider</Text>}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnSecondary, loading && styles.btnDisabled]}
              onPress={handleResendCode}
              disabled={loading}
            >
              <Text style={styles.btnSecondaryText}>Renvoyer le code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnDanger, loading && styles.btnDisabled]}
              onPress={handleCancelSignup}
              disabled={loading}
            >
              <Text style={styles.btnDangerText}>Annuler l'inscription</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Étape 5 : succès ── */}
        {step === 5 && (
          <View style={[styles.card, styles.centered]}>
            <Text style={styles.bigIcon}>✅</Text>
            <Text style={styles.cardTitle}>Inscription réussie !</Text>
            <Text style={styles.subtitle}>Redirection vers la connexion...</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { flexGrow: 1, padding: 24, paddingTop: 48 },
    title: { fontSize: 26, fontWeight: "bold", color: c.primary, textAlign: "center", marginBottom: 24 },
    stepsRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
    stepItem: { flex: 1, alignItems: "center" },
    stepCircle: {
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: c.border, alignItems: "center", justifyContent: "center",
    },
    stepCircleActive: { backgroundColor: c.primary },
    stepNum: { fontSize: 13, fontWeight: "bold", color: c.muted },
    stepNumActive: { color: c.bg },
    stepLabel: { fontSize: 10, color: c.muted, marginTop: 4, textAlign: "center" },
    card: { backgroundColor: c.surface, borderRadius: 12, padding: 20 },
    centered: { alignItems: "center" },
    cardTitle: { fontSize: 18, fontWeight: "bold", color: c.text, textAlign: "center", marginBottom: 12 },
    subtitle: { color: c.muted, fontSize: 13, textAlign: "center", marginBottom: 16 },
    label: { color: c.textSecondary, fontSize: 14, marginBottom: 6 },
    input: {
      backgroundColor: c.border, color: c.text, borderRadius: 8,
      padding: 14, marginBottom: 14, fontSize: 16,
    },
    suggestions: {
      backgroundColor: c.cardBg, borderRadius: 8, marginTop: -10, marginBottom: 10,
      borderWidth: 1, borderColor: c.border,
    },
    suggestion: { padding: 12, borderBottomWidth: 1, borderBottomColor: c.border },
    suggestionText: { color: c.text, fontSize: 14 },
    passwordRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 8 },
    eyeBtn: { padding: 10 },
    eyeText: { fontSize: 18 },
    rulesBox: { marginBottom: 8 },
    rule: { color: c.muted, fontSize: 13, marginBottom: 2 },
    ruleOk: { color: "#22c55e" },
    strengthTrack: { height: 6, backgroundColor: c.border, borderRadius: 3, marginTop: 8 },
    strengthFill: { height: 6, borderRadius: 3 },
    btn: {
      backgroundColor: c.primary, borderRadius: 8, padding: 16,
      alignItems: "center", marginTop: 4,
    },
    btnDisabled: { opacity: 0.5 },
    btnText: { color: c.bg, fontSize: 16, fontWeight: "bold" },
    btnSecondary: {
      backgroundColor: c.border, borderRadius: 8, padding: 14,
      alignItems: "center", marginTop: 10,
    },
    btnSecondaryText: { color: c.text, fontSize: 15 },
    btnDanger: {
      backgroundColor: c.cardBg, borderRadius: 8, padding: 14,
      alignItems: "center", marginTop: 10,
    },
    btnDangerText: { color: "#ff6b6b", fontSize: 15 },
    timer: { color: c.muted, fontSize: 13, textAlign: "center", marginVertical: 12 },
    linkWrap: { alignItems: "center", marginTop: 16 },
    link: { color: c.primary, fontSize: 14 },
    error: { color: "#ff6b6b", fontSize: 13, textAlign: "center", marginBottom: 8 },
    info: { color: "#22c55e", fontSize: 13, textAlign: "center", marginBottom: 8 },
    bigIcon: { fontSize: 48, marginBottom: 12 },
  });
}
