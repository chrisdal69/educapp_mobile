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
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const { login, selectClass, teachersClasses, followedClasses, pendingClassSelection } =
    useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const allClasses = [...teachersClasses, ...followedClasses];

  // Auto-sélection si une seule classe disponible
  useEffect(() => {
    if (pendingClassSelection && allClasses.length === 1) {
      handleSelectClass(allClasses[0].id);
    }
  }, [pendingClassSelection]);

  async function handleLogin() {
    setError("");
    setLoading(true);
    const result = await login(email.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Identifiants invalides");
    }
  }

  async function handleSelectClass(classId: string) {
    setError("");
    setLoading(true);
    const result = await selectClass(classId);
    setLoading(false);
    if (!result.ok) {
      setError(result.message ?? "Erreur lors de la connexion");
    }
  }

  // Écran de sélection de classe
  if (pendingClassSelection && allClasses.length !== 1) {
    if (allClasses.length === 0) {
      return (
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.title}>MathsApp</Text>
          <Text style={styles.subtitle}>Vous n'êtes inscrit à aucune classe active.</Text>
        </View>
      );
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.classListInner}>
          <Text style={styles.title}>Choisir une classe</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {loading ? (
            <ActivityIndicator color="#ffd33d" style={{ marginTop: 32 }} />
          ) : (
            <>
              {teachersClasses.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Mes classes (professeur)</Text>
                  {teachersClasses.map((cl) => (
                    <TouchableOpacity
                      key={cl.id}
                      style={styles.classButton}
                      onPress={() => handleSelectClass(cl.id)}
                    >
                      <Text style={styles.classButtonText}>{cl.publicname}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
              {followedClasses.length > 0 && (
                <>
                  <Text style={styles.sectionLabel}>Classes suivies</Text>
                  {followedClasses.map((cl) => (
                    <TouchableOpacity
                      key={cl.id}
                      style={styles.classButton}
                      onPress={() => handleSelectClass(cl.id)}
                    >
                      <Text style={styles.classButtonText}>{cl.publicname}</Text>
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  // Formulaire de connexion
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>MathsApp</Text>
        <Text style={styles.subtitle}>Connexion</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#888"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Mot de passe"
          placeholderTextColor="#888"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#25292e" />
          ) : (
            <Text style={styles.buttonText}>Se connecter</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#25292e" },
  centered: { justifyContent: "center", alignItems: "center", padding: 24 },
  inner: { flexGrow: 1, justifyContent: "center", padding: 24 },
  classListInner: { padding: 24 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#ffd33d",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#fff",
    textAlign: "center",
    marginBottom: 32,
  },
  input: {
    backgroundColor: "#333940",
    color: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#ffd33d",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#25292e", fontSize: 16, fontWeight: "bold" },
  error: { color: "#ff6b6b", textAlign: "center", marginBottom: 16 },
  sectionLabel: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 16,
    marginBottom: 8,
  },
  classButton: {
    backgroundColor: "#333940",
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  classButtonText: { color: "#fff", fontSize: 16 },
});
