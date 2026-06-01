import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { apiFetch } from "../utils/apiClient";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { ThemeColors } from "../theme";

const CONFIRM_TEXT = "Elève à désinscrire";

const REGEN_OPTIONS = [
  { label: "3 jours",    value: "3d" },
  { label: "1 semaine",  value: "1w" },
  { label: "2 semaines", value: "2w" },
];

type Student = {
  studentId: string;
  userId?: string;
  nom: string;
  prenom: string;
  email?: string;
};

type Repertoire = {
  slug: string;
  label: string;
  teachers?: string[];
};

function formatFrDate(value: string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

export default function ManageClassScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const classId   = user?.classId ? String(user.classId) : "";
  const className = user?.publicname ?? "";

  // ── données ──────────────────────────────────────────────────────────────
  const [students,              setStudents]              = useState<Student[]>([]);
  const [repertoires,           setRepertoires]           = useState<Repertoire[]>([]);
  const [exceptionVisibleIds,   setExceptionVisibleIds]   = useState<string[]>([]);
  const [classCode,             setClassCode]             = useState("");
  const [classCodeExpires,      setClassCodeExpires]      = useState<string | null>(null);

  // ── chargements ──────────────────────────────────────────────────────────
  const [loading,       setLoading]       = useState(false);
  const [codeLoading,   setCodeLoading]   = useState(false);
  const [reposLoading,  setReposLoading]  = useState(false);
  const [error,         setError]         = useState("");

  // ── régénération du code ──────────────────────────────────────────────────
  const [showRegen,    setShowRegen]    = useState(false);
  const [regenDur,     setRegenDur]     = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  // ── ajout élève ───────────────────────────────────────────────────────────
  const [showAdd,    setShowAdd]    = useState(false);
  const [addNom,     setAddNom]     = useState("");
  const [addPrenom,  setAddPrenom]  = useState("");
  const [addLoading, setAddLoading] = useState(false);

  // ── désinscrire ───────────────────────────────────────────────────────────
  const [deleteOpenKey,    setDeleteOpenKey]    = useState("");
  const [deleteConfirm,    setDeleteConfirm]    = useState("");
  const [deleteLoadingKey, setDeleteLoadingKey] = useState("");

  // ── droits teacher ────────────────────────────────────────────────────────
  const [teacherOpenKey,    setTeacherOpenKey]    = useState("");
  const [teacherSelection,  setTeacherSelection]  = useState<string[]>([]);
  const [teacherLoadingKey, setTeacherLoadingKey] = useState("");

  // ── exception visibilité ──────────────────────────────────────────────────
  const [excLoadingKey, setExcLoadingKey] = useState("");

  // ── map userId → slugs teacher ───────────────────────────────────────────
  const teacherSlugsByUserId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    repertoires.forEach((rep) => {
      (rep.teachers ?? []).forEach((tid) => {
        const key = String(tid);
        if (!map.has(key)) map.set(key, new Set());
        map.get(key)!.add(rep.slug);
      });
    });
    return map;
  }, [repertoires]);

  const exceptionSet = useMemo(
    () => new Set(exceptionVisibleIds.map(String)),
    [exceptionVisibleIds]
  );

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    if (!classId) return;
    setLoading(true); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/students`);
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur chargement élèves."); return; }
      setStudents(data.students ?? []);
      setExceptionVisibleIds(data.exceptionvisible ?? []);
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setLoading(false); }
  }, [classId]);

  const fetchRepertoires = useCallback(async () => {
    if (!classId) return;
    setReposLoading(true);
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/repertoires`);
      const data = await res.json();
      if (res.ok) setRepertoires(data.repertoires ?? []);
    } catch {}
    finally { setReposLoading(false); }
  }, [classId]);

  const fetchCode = useCallback(async () => {
    if (!classId) return;
    setCodeLoading(true);
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/code`);
      const data = await res.json();
      if (res.ok) { setClassCode(data.code ?? ""); setClassCodeExpires(data.codeExpires ?? null); }
    } catch {}
    finally { setCodeLoading(false); }
  }, [classId]);

  useEffect(() => {
    fetchStudents();
    fetchRepertoires();
    fetchCode();
  }, [fetchStudents, fetchRepertoires, fetchCode]);

  // ── actions ────────────────────────────────────────────────────────────────
  async function handleRegen() {
    if (!regenDur) return;
    setRegenLoading(true); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/code/regenerate`, {
        method: "POST", body: JSON.stringify({ duration: regenDur }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setClassCode(data.code ?? "");
      setClassCodeExpires(data.codeExpires ?? null);
      setShowRegen(false); setRegenDur("");
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setRegenLoading(false); }
  }

  async function handleAddStudent() {
    const nom    = addNom.trim();
    const prenom = addPrenom.trim();
    if (!nom || !prenom) return;
    setAddLoading(true); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/students`, {
        method: "POST", body: JSON.stringify({ nom, prenom }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setShowAdd(false); setAddNom(""); setAddPrenom("");
      await fetchStudents();
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setAddLoading(false); }
  }

  async function handleUnsubscribe(st: Student) {
    const key = st.studentId;
    setDeleteLoadingKey(key); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/students/${key}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setStudents((prev) => prev.filter((s) => s.studentId !== key));
      if (st.userId) setExceptionVisibleIds((prev) => prev.filter((id) => id !== st.userId));
      setDeleteOpenKey(""); setDeleteConfirm("");
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setDeleteLoadingKey(""); }
  }

  async function handleSaveTeachers(st: Student) {
    if (!st.userId) return;
    setTeacherLoadingKey(st.studentId); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/repertoires/teachers`, {
        method: "PATCH",
        body: JSON.stringify({ userId: st.userId, adminRepertoires: teacherSelection }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setRepertoires(data.repertoires ?? []);
      setTeacherOpenKey(""); setTeacherSelection([]);
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setTeacherLoadingKey(""); }
  }

  async function handleToggleException(st: Student) {
    const key = st.studentId;
    setExcLoadingKey(key); setError("");
    try {
      const res  = await apiFetch(`/users/admin/class/${classId}/exceptionvisible`, {
        method: "PATCH",
        body: JSON.stringify({ studentId: st.studentId, userId: st.userId ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Erreur."); return; }
      setExceptionVisibleIds(data.exceptionvisible ?? []);
    } catch { setError("Impossible de joindre le serveur."); }
    finally   { setExcLoadingKey(""); }
  }

  function toggleTeacherSlug(slug: string) {
    setTeacherSelection((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  // ── rendu ──────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Retour</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Gérer la classe</Text>
      <Text style={styles.subtitle}>{className}</Text>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* ── Code d'inscription ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Code d'inscription</Text>
        <View style={styles.codeRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.codeValue}>
              {codeLoading ? "…" : classCode || "—"}
            </Text>
            <Text style={styles.codeExpiry}>
              Expire le : {codeLoading ? "…" : formatFrDate(classCodeExpires)}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.regenBtn}
            onPress={() => { setShowRegen((v) => !v); setRegenDur(""); }}
          >
            <Text style={styles.regenBtnText}>Régénérer</Text>
          </TouchableOpacity>
        </View>

        {showRegen && (
          <View style={styles.regenForm}>
            <Text style={styles.label}>Durée de validité</Text>
            <View style={styles.regenOptions}>
              {REGEN_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.regenOpt, regenDur === opt.value && styles.regenOptActive]}
                  onPress={() => setRegenDur(opt.value)}
                >
                  <Text style={[styles.regenOptText, regenDur === opt.value && styles.regenOptTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.rowBtns}>
              <TouchableOpacity style={styles.btnSecondary} onPress={() => { setShowRegen(false); setRegenDur(""); }}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, (!regenDur || regenLoading) && styles.btnDisabled]}
                onPress={handleRegen}
                disabled={!regenDur || regenLoading}
              >
                {regenLoading ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.btnText}>Valider</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* ── Liste des élèves ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Élèves ({students.length})</Text>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => { setShowAdd((v) => !v); setAddNom(""); setAddPrenom(""); }}
          >
            <Text style={styles.addBtnText}>{showAdd ? "Annuler" : "+ Ajouter"}</Text>
          </TouchableOpacity>
        </View>

        {showAdd && (
          <View style={styles.addForm}>
            <TextInput
              style={styles.input}
              value={addNom}
              onChangeText={setAddNom}
              placeholder="Nom"
              placeholderTextColor={colors.muted}
              editable={!addLoading}
              autoCapitalize="words"
            />
            <TextInput
              style={styles.input}
              value={addPrenom}
              onChangeText={setAddPrenom}
              placeholder="Prénom"
              placeholderTextColor={colors.muted}
              editable={!addLoading}
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={[styles.btn, (!addNom.trim() || !addPrenom.trim() || addLoading) && styles.btnDisabled]}
              onPress={handleAddStudent}
              disabled={!addNom.trim() || !addPrenom.trim() || addLoading}
            >
              {addLoading ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.btnText}>Inscrire</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
        ) : students.length === 0 ? (
          <Text style={styles.empty}>Aucun élève inscrit.</Text>
        ) : (
          students.map((st, idx) => {
            const key               = st.studentId;
            const userId            = st.userId ?? "";
            const teacherSlugsSet   = userId ? teacherSlugsByUserId.get(userId) : null;
            const isTeacher         = !!teacherSlugsSet && teacherSlugsSet.size > 0;
            const isExcVisible      = !!userId && exceptionSet.has(userId);
            const isDeleteOpen      = deleteOpenKey === key;
            const isTeacherOpen     = teacherOpenKey === key;
            const isDeleting        = deleteLoadingKey === key;
            const isTeacherSaving   = teacherLoadingKey === key;
            const isExcLoading      = excLoadingKey === key;

            return (
              <View key={key} style={[styles.studentRow, idx % 2 === 1 && styles.studentRowAlt]}>
                {/* Infos */}
                <View style={{ flex: 1, marginBottom: 6 }}>
                  <Text style={styles.studentName}>
                    {st.nom} {st.prenom}
                  </Text>
                  <Text style={styles.studentEmail}>{st.email || "Non inscrit"}</Text>
                </View>

                {/* Boutons d'action */}
                <View style={styles.actionBtns}>
                  {/* Exception visibilité */}
                  <TouchableOpacity
                    style={[styles.iconBtn, isExcVisible && styles.iconBtnActive]}
                    onPress={() => handleToggleException(st)}
                    disabled={!userId || isExcLoading}
                  >
                    {isExcLoading
                      ? <ActivityIndicator size="small" color={colors.primary} />
                      : <Text style={[styles.iconBtnText, !userId && styles.iconBtnDisabled]}>
                          {isExcVisible ? "👁" : "🚫👁"}
                        </Text>}
                  </TouchableOpacity>

                  {/* Droits teacher */}
                  <TouchableOpacity
                    style={[styles.iconBtn, isTeacher && styles.iconBtnTeacher]}
                    onPress={() => {
                      if (!userId) return;
                      if (isTeacherOpen) {
                        setTeacherOpenKey(""); setTeacherSelection([]);
                      } else {
                        setTeacherOpenKey(key);
                        setTeacherSelection(teacherSlugsSet ? [...teacherSlugsSet] : []);
                        setDeleteOpenKey(""); setDeleteConfirm("");
                      }
                    }}
                    disabled={!userId}
                  >
                    <Text style={[styles.iconBtnText, !userId && styles.iconBtnDisabled]}>👤</Text>
                  </TouchableOpacity>

                  {/* Désinscrire */}
                  <TouchableOpacity
                    style={[styles.iconBtn, styles.iconBtnDanger]}
                    onPress={() => {
                      if (isDeleteOpen) {
                        setDeleteOpenKey(""); setDeleteConfirm("");
                      } else {
                        setDeleteOpenKey(key); setDeleteConfirm("");
                        setTeacherOpenKey(""); setTeacherSelection([]);
                      }
                    }}
                  >
                    {isDeleting
                      ? <ActivityIndicator size="small" color="#ff6b6b" />
                      : <Text style={styles.iconBtnText}>🗑</Text>}
                  </TouchableOpacity>
                </View>

                {/* Panneau droits teacher */}
                {isTeacherOpen && (
                  <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Droits teacher</Text>
                    {reposLoading
                      ? <ActivityIndicator color={colors.primary} />
                      : repertoires.length === 0
                      ? <Text style={styles.empty}>Aucun répertoire.</Text>
                      : repertoires.map((rep) => (
                          <TouchableOpacity
                            key={rep.slug}
                            style={styles.checkRow}
                            onPress={() => toggleTeacherSlug(rep.slug)}
                          >
                            <View style={[styles.checkbox, teacherSelection.includes(rep.slug) && styles.checkboxChecked]}>
                              {teacherSelection.includes(rep.slug) && <Text style={styles.checkmark}>✓</Text>}
                            </View>
                            <Text style={styles.checkLabel}>{rep.label}</Text>
                          </TouchableOpacity>
                        ))}
                    <View style={[styles.rowBtns, { marginTop: 10 }]}>
                      <TouchableOpacity style={styles.btnSecondary} onPress={() => { setTeacherOpenKey(""); setTeacherSelection([]); }}>
                        <Text style={styles.btnSecondaryText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, isTeacherSaving && styles.btnDisabled]}
                        onPress={() => handleSaveTeachers(st)}
                        disabled={isTeacherSaving}
                      >
                        {isTeacherSaving ? <ActivityIndicator color={colors.bg} size="small" /> : <Text style={styles.btnText}>Valider</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Panneau désinscrire */}
                {isDeleteOpen && (
                  <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Confirmer la désinscription</Text>
                    <Text style={styles.deleteWarning}>
                      ⚠️ Tous les fichiers uploadés par cet élève seront supprimés.
                    </Text>
                    <Text style={styles.label}>Saisir : <Text style={styles.confirmPhrase}>{CONFIRM_TEXT}</Text></Text>
                    <TextInput
                      style={styles.input}
                      value={deleteConfirm}
                      onChangeText={setDeleteConfirm}
                      placeholder={CONFIRM_TEXT}
                      placeholderTextColor={colors.muted}
                      editable={!isDeleting}
                    />
                    <View style={styles.rowBtns}>
                      <TouchableOpacity style={styles.btnSecondary} onPress={() => { setDeleteOpenKey(""); setDeleteConfirm(""); }}>
                        <Text style={styles.btnSecondaryText}>Annuler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btnDanger, (deleteConfirm !== CONFIRM_TEXT || isDeleting) && styles.btnDisabled]}
                        onPress={() => handleUnsubscribe(st)}
                        disabled={deleteConfirm !== CONFIRM_TEXT || isDeleting}
                      >
                        {isDeleting ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnDangerText}>Désinscrire</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 20, paddingTop: 48, paddingBottom: 40 },
    backBtn: { marginBottom: 16 },
    backText: { color: c.primary, fontSize: 15 },
    title: { fontSize: 22, fontWeight: "bold", color: c.text, marginBottom: 2 },
    subtitle: { fontSize: 15, color: c.muted, marginBottom: 20 },
    error: { color: "#ff6b6b", fontSize: 13, marginBottom: 12 },
    section: { backgroundColor: c.surface, borderRadius: 12, padding: 16, marginBottom: 16 },
    sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
    sectionTitle: { color: c.primary, fontSize: 15, fontWeight: "700", marginBottom: 8 },
    // Code
    codeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    codeValue: { color: c.text, fontSize: 22, fontFamily: "monospace", fontWeight: "bold" },
    codeExpiry: { color: c.muted, fontSize: 12, marginTop: 2 },
    regenBtn: { backgroundColor: c.border, borderRadius: 8, padding: 10 },
    regenBtnText: { color: c.primary, fontSize: 13, fontWeight: "600" },
    regenForm: { marginTop: 14, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 12 },
    regenOptions: { flexDirection: "row", gap: 8, marginBottom: 12 },
    regenOpt: { flex: 1, backgroundColor: c.border, borderRadius: 8, padding: 10, alignItems: "center" },
    regenOptActive: { backgroundColor: c.primary },
    regenOptText: { color: c.text, fontSize: 13 },
    regenOptTextActive: { color: c.bg, fontWeight: "bold" },
    // Add
    addBtn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
    addBtnText: { color: c.bg, fontSize: 13, fontWeight: "700" },
    addForm: { marginBottom: 12 },
    // Student rows
    studentRow: { padding: 12, borderRadius: 8, marginBottom: 4 },
    studentRowAlt: { backgroundColor: c.cardBg },
    studentName: { color: c.text, fontSize: 14, fontWeight: "600" },
    studentEmail: { color: c.muted, fontSize: 12, marginTop: 2 },
    actionBtns: { flexDirection: "row", gap: 8, marginBottom: 4 },
    iconBtn: { backgroundColor: c.border, borderRadius: 6, padding: 8, minWidth: 38, alignItems: "center" },
    iconBtnActive: { backgroundColor: "rgba(55,149,78,0.2)" },
    iconBtnTeacher: { backgroundColor: "rgba(100,50,200,0.2)" },
    iconBtnDanger: { backgroundColor: "rgba(220,38,38,0.18)" },
    iconBtnText: { fontSize: 15 },
    iconBtnDisabled: { opacity: 0.3 },
    // Panel
    panel: { backgroundColor: c.cardBg, borderRadius: 8, padding: 12, marginTop: 8 },
    panelTitle: { color: c.text, fontSize: 14, fontWeight: "600", marginBottom: 10 },
    deleteWarning: { color: "#f97316", fontSize: 12, marginBottom: 10 },
    confirmPhrase: { color: c.primary, fontWeight: "bold" },
    checkRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
    checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, borderColor: c.border, alignItems: "center", justifyContent: "center" },
    checkboxChecked: { backgroundColor: c.primary, borderColor: c.primary },
    checkmark: { color: c.bg, fontSize: 12, fontWeight: "bold" },
    checkLabel: { color: c.text, fontSize: 14 },
    empty: { color: c.muted, fontSize: 13, textAlign: "center", paddingVertical: 12 },
    // Inputs & buttons
    label: { color: c.textSecondary, fontSize: 13, marginBottom: 6 },
    input: { backgroundColor: c.border, color: c.text, borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 15 },
    rowBtns: { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
    btn: { backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, alignItems: "center" },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: c.bg, fontSize: 14, fontWeight: "bold" },
    btnSecondary: { backgroundColor: c.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    btnSecondaryText: { color: c.text, fontSize: 14 },
    btnDanger: { backgroundColor: "#dc2626", borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
    btnDangerText: { color: "#fff", fontSize: 14, fontWeight: "bold" },
  });
}
