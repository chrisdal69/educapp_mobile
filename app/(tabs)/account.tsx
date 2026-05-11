import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { apiFetch } from "../../utils/apiClient";

export default function AccountScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();

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
        <ActivityIndicator color="#ffd33d" />
      </View>
    );
  }

  const initials = `${user.prenom?.[0] ?? ""}${user.nom?.[0] ?? ""}`.toUpperCase();

  const actions: { label: string; route: string; danger?: boolean }[] = [
    { label: "Changer le mot de passe", route: "/changepassword" },
    { label: "Changer l'email", route: "/changemail" },
    { label: "Quitter la classe", route: "/leaveclass" },
    { label: "Supprimer le compte", route: "/deleteaccount", danger: true },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
      {/* Carte identité */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user.prenom} {user.nom}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{user.role === "admin" ? "Professeur" : "Élève"}</Text>
        </View>
        <Text style={styles.className}>{user.publicname}</Text>
      </View>

      {/* Actions */}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e" },
  inner: { padding: 24, paddingTop: 48 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#25292e" },
  profileCard: {
    backgroundColor: "#1e2227", borderRadius: 16, padding: 24,
    alignItems: "center", marginBottom: 24,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#ffd33d", alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { fontSize: 28, fontWeight: "bold", color: "#25292e" },
  name: { fontSize: 20, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  badge: {
    backgroundColor: "#2a3040", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4,
    marginBottom: 8,
  },
  badgeText: { color: "#ffd33d", fontSize: 12, fontWeight: "600" },
  className: { color: "#aaa", fontSize: 14 },
  section: { marginBottom: 24 },
  sectionTitle: { color: "#888", fontSize: 13, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 },
  actionRow: {
    backgroundColor: "#1e2227", borderRadius: 10, padding: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: 8,
  },
  actionRowDanger: { backgroundColor: "#2a1a1a" },
  actionLabel: { color: "#fff", fontSize: 15 },
  actionLabelDanger: { color: "#ff6b6b" },
  chevron: { color: "#555", fontSize: 20 },
  logoutBtn: {
    backgroundColor: "#333940", borderRadius: 10, padding: 16,
    alignItems: "center", marginTop: 8,
  },
  logoutText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
