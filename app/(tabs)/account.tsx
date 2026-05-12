import { useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ThemeColors } from "../../theme";
import { apiFetch } from "../../utils/apiClient";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const { isDark, colors, toggleTheme } = useTheme();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  async function handleLogout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } catch {
      // On continue même si la requête échoue
    } finally {
      await logout();
    }
  }

  if (!user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const initials = `${user.prenom?.[0] ?? ""}${user.nom?.[0] ?? ""}`.toUpperCase();
  const isAdminCurrentClass = user.role === "admin";
  const canDeleteAccount = !user.isAdminAnywhere;

  const actions: { label: string; route: string; danger?: boolean }[] = [
    { label: "Changer le mot de passe", route: "/changepassword" },
    { label: "Changer l'email", route: "/changemail" },
    ...(isAdminCurrentClass
      ? [{ label: "Gérer ma classe", route: "/manageclass" }]
      : [{ label: "Quitter la classe", route: "/leaveclass" }]),
    ...(canDeleteAccount
      ? [{ label: "Supprimer le compte", route: "/deleteaccount", danger: true }]
      : []),
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Carte identité */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>
          {user.prenom} {user.nom}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {user.role === "admin" ? "Professeur" : "Élève"}
          </Text>
        </View>
        <Text style={styles.className}>{user.publicname}</Text>
      </View>

      {/* Apparence */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Apparence</Text>
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Mode sombre</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={colors.surface}
          />
        </View>
      </View>

      {/* Paramètres du compte */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Paramètres du compte</Text>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={[styles.actionRow, action.danger && styles.actionRowDanger]}
            onPress={() => router.push(action.route as any)}
          >
            <Text style={[styles.actionLabel, action.danger && styles.actionLabelDanger]}>
              {action.label}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Déconnexion */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Se déconnecter</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function makeStyles(c: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: c.bg },
    inner: { padding: 24, paddingTop: 48 },
    center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: c.bg },
    profileCard: {
      backgroundColor: c.surface,
      borderRadius: 16,
      padding: 24,
      alignItems: "center",
      marginBottom: 24,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: c.primary,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 12,
    },
    avatarText: { fontSize: 28, fontWeight: "bold", color: c.bg },
    name: { fontSize: 20, fontWeight: "bold", color: c.text, marginBottom: 8 },
    badge: {
      backgroundColor: c.badge,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 4,
      marginBottom: 8,
    },
    badgeText: { color: c.primary, fontSize: 12, fontWeight: "600" },
    className: { color: c.muted, fontSize: 14 },
    section: { marginBottom: 24 },
    sectionTitle: {
      color: c.muted,
      fontSize: 13,
      marginBottom: 8,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    toggleRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    toggleLabel: { color: c.text, fontSize: 15 },
    actionRow: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 8,
    },
    actionRowDanger: { backgroundColor: c.dangerBg },
    actionLabel: { color: c.text, fontSize: 15 },
    actionLabelDanger: { color: c.danger },
    chevron: { color: c.muted, fontSize: 20 },
    logoutBtn: {
      backgroundColor: c.surface,
      borderRadius: 10,
      padding: 16,
      alignItems: "center",
      marginTop: 8,
      borderWidth: 1,
      borderColor: c.border,
    },
    logoutText: { color: c.danger, fontSize: 16, fontWeight: "600" },
  });
}
