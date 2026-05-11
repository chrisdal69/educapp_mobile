import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

export default function ManageClassScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <Text style={styles.backText}>← Retour</Text>
      </TouchableOpacity>
      <Text style={styles.icon}>🏗️</Text>
      <Text style={styles.title}>Gérer ma classe</Text>
      <Text style={styles.subtitle}>Cette fonctionnalité est en cours de développement.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e", padding: 24, paddingTop: 48 },
  backBtn: { marginBottom: 32 },
  backText: { color: "#ffd33d", fontSize: 15 },
  icon: { fontSize: 48, textAlign: "center", marginBottom: 16 },
  title: { fontSize: 22, fontWeight: "bold", color: "#fff", textAlign: "center", marginBottom: 12 },
  subtitle: { color: "#aaa", fontSize: 15, textAlign: "center" },
});
