import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AppText from "@/components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

const WORD = "MathsApp";
const LETTERS = Array.from(WORD);
const HALF_INDEX = Math.ceil(LETTERS.length / 2);
const { width: SW, height: SH } = Dimensions.get("window");
// Char width ≈ 0.6em for Courier New (monospace)
const CHAR_WIDTH_RATIO = 0.6;
// FONT_SIZE chosen so the assembled word exactly fills SW:
// visual_width = (n-1)*spacing + charWidth = FONT_SIZE*((n-1)*0.63 + 0.6) = SW
const FONT_SIZE = Math.round(SW / ((LETTERS.length - 1) * 0.63 + CHAR_WIDTH_RATIO));

const LETTER_SPACING = FONT_SIZE * 0.63;
// Include last char width so the word is visually centered (not just anchor-centered)
const WORD_HALF_WIDTH = ((LETTERS.length - 1) * LETTER_SPACING + FONT_SIZE * CHAR_WIDTH_RATIO) / 2;

const ANIM = {
  lettersDuration: 1100,
  loginDuration: 2000,
  veilDuration: 150,
  exitPanelDuration: 600,
  exitVeilDuration: 400,
  assembleDuration: 500,
  assembleStagger: 90,
};

function computeLetterPositions(): Array<{ x: number; y: number }> {
  const pad = 24;
  const exclMinY = SH * 0.3;
  const exclMaxY = SH * 0.72;

  return LETTERS.map(() => {
    let x = 0;
    let y = 0;
    let attempts = 0;
    do {
      x = pad + Math.random() * (SW - pad * 2);
      y = pad + Math.random() * (SH - pad * 2);
      attempts++;
    } while (y >= exclMinY && y <= exclMaxY && attempts < 120);

    if (y >= exclMinY && y <= exclMaxY) {
      const topH = exclMinY - pad;
      const botH = SH - pad - exclMaxY;
      y =
        topH >= botH
          ? pad + Math.random() * topH
          : exclMaxY + Math.random() * botH;
    }

    return { x: Math.round(x), y: Math.round(y) };
  });
}

export default function LoginScreen() {
  const { login, logout, selectClass, teachersClasses, followedClasses, pendingClassSelection } =
    useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const allClasses = [...teachersClasses, ...followedClasses];
  const isFormFilled = email.trim().length > 0 && password.length > 0;

  // Animated values
  const positions = useRef(computeLetterPositions()).current;

  const letterTransX = useRef(
    LETTERS.map((_, i) => {
      const startX = i < HALF_INDEX ? -0.12 * SW : 1.12 * SW;
      return new Animated.Value(startX - positions[i].x);
    })
  ).current;
  const letterTransY = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const letterOpacity = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  const loginScale = useRef(new Animated.Value(0)).current;
  const loginOpacity = useRef(new Animated.Value(0)).current;
  const veilOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (pendingClassSelection && allClasses.length === 1) {
      handleSelectClass(allClasses[0].id);
    }
  }, [pendingClassSelection]);

  useEffect(() => {
    if (!pendingClassSelection || allClasses.length > 0) return;
    const timer = setTimeout(async () => {
      await logout();
      revertToLoginState();
    }, 4000);
    return () => clearTimeout(timer);
  }, [pendingClassSelection, teachersClasses.length, followedClasses.length]);

  // Intro animation
  useEffect(() => {
    playIntroAnimation();
  }, []);

  function playIntroAnimation() {
    Animated.parallel([
      ...LETTERS.map((_, i) =>
        Animated.parallel([
          Animated.timing(letterTransX[i], {
            toValue: 0,
            duration: ANIM.lettersDuration,
            easing: Easing.bezier(0.22, 0.7, 0.2, 1),
            useNativeDriver: true,
          }),
          Animated.timing(letterOpacity[i], {
            toValue: 1,
            duration: ANIM.lettersDuration,
            easing: Easing.bezier(0.22, 0.7, 0.2, 1),
            useNativeDriver: true,
          }),
        ])
      ),
      Animated.timing(loginScale, {
        toValue: 1,
        duration: ANIM.loginDuration,
        easing: Easing.bezier(0.2, 0.85, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(loginOpacity, {
        toValue: 1,
        duration: ANIM.loginDuration,
        easing: Easing.bezier(0.2, 0.85, 0.2, 1),
        useNativeDriver: true,
      }),
      Animated.timing(veilOpacity, {
        toValue: 0.3,
        duration: ANIM.veilDuration,
        delay: ANIM.loginDuration,
        easing: Easing.bezier(0, 0, 0.58, 1),
        useNativeDriver: true,
      }),
    ]).start();
  }

  // Returns a promise that resolves once the full exit animation is done
  function playExitAnimation(): Promise<void> {
    const assembleTargetY = SH / 2 - FONT_SIZE * 0.6;

    return new Promise((resolve) => {
      // Phase 1: panel scales to 0 + veil fades out
      Animated.parallel([
        Animated.timing(loginScale, {
          toValue: 0,
          duration: ANIM.exitPanelDuration,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(loginOpacity, {
          toValue: 0,
          duration: ANIM.exitPanelDuration,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(veilOpacity, {
          toValue: 0,
          duration: ANIM.exitVeilDuration,
          easing: Easing.bezier(0, 0, 0.58, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        // Phase 2: letters assemble to form "MathsApp" in center
        const assembleAnims = LETTERS.map((_, i) => {
          const targetAbsX = SW / 2 - WORD_HALF_WIDTH + i * LETTER_SPACING;
          return Animated.parallel([
            Animated.timing(letterTransX[i], {
              toValue: targetAbsX - positions[i].x,
              duration: ANIM.assembleDuration,
              easing: Easing.bezier(0.2, 0.7, 0.2, 1),
              useNativeDriver: true,
            }),
            Animated.timing(letterTransY[i], {
              toValue: assembleTargetY - positions[i].y,
              duration: ANIM.assembleDuration,
              easing: Easing.bezier(0.2, 0.7, 0.2, 1),
              useNativeDriver: true,
            }),
          ]);
        });
        Animated.stagger(ANIM.assembleStagger, assembleAnims).start(() => resolve());
      });
    });
  }

  function revertToLoginState() {
    // Reset all animated values to their intro start
    LETTERS.forEach((_, i) => {
      const startX = i < HALF_INDEX ? -0.12 * SW : 1.12 * SW;
      letterTransX[i].setValue(startX - positions[i].x);
      letterTransY[i].setValue(0);
      letterOpacity[i].setValue(0);
    });
    loginScale.setValue(0);
    loginOpacity.setValue(0);
    veilOpacity.setValue(0);
    playIntroAnimation();
  }

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
    // Animation plays fully BEFORE the API call so root layout
    // navigation cannot interrupt it
    await playExitAnimation();
    const result = await selectClass(classId);
    if (!result.ok) {
      const msg = result.message ?? "Erreur lors de la connexion";
      setError(msg);
      setSelectedClassId(null);
      revertToLoginState();
      if (/expir|session|token|authentif/i.test(msg)) {
        setTimeout(async () => {
          setError("");
          await logout();
          revertToLoginState();
        }, 3000);
      }
    }
    // On success: AuthContext updates user → root layout navigates to /(tabs)
  }

  const showClassSelect = pendingClassSelection && allClasses.length !== 1;

  function renderPanelContent() {
    if (showClassSelect) {
      if (allClasses.length === 0) {
        return (
          <View style={styles.panelBody}>
            <AppText style={styles.panelTitle}>MathsApp</AppText>
            <AppText style={styles.panelSubtitle}>
              Vous n'êtes inscrit à aucune classe active.
            </AppText>
          </View>
        );
      }

      return (
        <View style={styles.panelBody}>
          <AppText style={styles.panelTitle}>Choisir une classe</AppText>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
          {teachersClasses.length > 0 && (
            <AppText style={styles.sectionLabel}>Mes classes (professeur)</AppText>
          )}
          {teachersClasses.map((cl) => (
            <TouchableOpacity
              key={cl.id}
              style={styles.classItem}
              onPress={() => setSelectedClassId(cl.id)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.checkbox, selectedClassId === cl.id && styles.checkboxSelected]}
              />
              <AppText style={styles.classItemText}>{cl.publicname}</AppText>
            </TouchableOpacity>
          ))}
          {followedClasses.length > 0 && (
            <AppText style={styles.sectionLabel}>Classes suivies</AppText>
          )}
          {followedClasses.map((cl) => (
            <TouchableOpacity
              key={cl.id}
              style={styles.classItem}
              onPress={() => setSelectedClassId(cl.id)}
              activeOpacity={0.7}
            >
              <View
                style={[styles.checkbox, selectedClassId === cl.id && styles.checkboxSelected]}
              />
              <AppText style={styles.classItemText}>{cl.publicname}</AppText>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[
              styles.submitButton,
              selectedClassId ? styles.submitButtonActive : styles.submitButtonIdle,
            ]}
            onPress={() => selectedClassId && handleSelectClass(selectedClassId)}
            disabled={!selectedClassId}
          >
            <AppText
              style={[
                styles.submitButtonText,
                selectedClassId ? styles.submitButtonTextActive : styles.submitButtonTextIdle,
              ]}
            >
              Valider
            </AppText>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.panelBody}>
        <AppText style={styles.panelTitle}>Se connecter</AppText>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        <AppText style={styles.fieldLabel}>Email</AppText>
        <TextInput
          style={styles.input}
          placeholderTextColor="#bbb"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        <AppText style={styles.fieldLabel}>Mot de passe</AppText>
        <View style={styles.inputRow}>
          <TextInput
            style={[styles.input, styles.inputWithEye]}
            placeholderTextColor="#bbb"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={() => setShowPassword((v) => !v)}
            activeOpacity={0.6}
          >
            <Ionicons
              name={showPassword ? "eye-off-outline" : "eye-outline"}
              size={20}
              color="#999"
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={[
            styles.submitButton,
            isFormFilled && !loading ? styles.submitButtonActive : styles.submitButtonIdle,
          ]}
          onPress={handleLogin}
          disabled={loading || !isFormFilled}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <AppText
              style={[
                styles.submitButtonText,
                isFormFilled ? styles.submitButtonTextActive : styles.submitButtonTextIdle,
              ]}
            >
              Se connecter
            </AppText>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/forgot" as any)} style={styles.link}>
          <AppText style={styles.linkText}>Mot de passe oublié ?</AppText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("/signup" as any)} style={styles.link}>
          <AppText style={styles.linkText}>S'inscrire</AppText>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.animContainer}>
      {LETTERS.map((letter, i) => (
        <Animated.Text
          key={`${letter}-${i}`}
          style={[
            styles.floatLetter,
            {
              left: positions[i].x,
              top: positions[i].y,
              opacity: letterOpacity[i],
              transform: [
                { translateX: letterTransX[i] },
                { translateY: letterTransY[i] },
              ],
            },
          ]}
        >
          {letter}
        </Animated.Text>
      ))}

      <Animated.View pointerEvents="none" style={[styles.veil, { opacity: veilOpacity }]} />

      <KeyboardAvoidingView
        style={styles.loginWrapper}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Animated.View
          style={[
            styles.loginPanel,
            { opacity: loginOpacity, transform: [{ scale: loginScale }] },
          ]}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {renderPanelContent()}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  animContainer: {
    flex: 1,
    backgroundColor: "#8e9d8b",
    overflow: "hidden",
  },
  floatLetter: {
    position: "absolute",
    fontFamily: "CourierNew",
    fontSize: FONT_SIZE,
    color: "#1a1a1a",
  },
  veil: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#191e24",
  },
  loginWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  loginPanel: {
    width: "100%",
    maxHeight: SH * 0.82,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  scrollContent: {
    flexGrow: 1,
  },
  panelBody: {
    padding: 28,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111111",
    textAlign: "center",
    marginBottom: 20,
  },
  panelSubtitle: {
    fontSize: 15,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 6,
    marginTop: 15,
  },
  input: {
    backgroundColor: "#ffffff",
    color: "#111",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    fontSize: 15,
  },
  inputRow: {
    position: "relative",
    marginBottom: 16,
  },
  inputWithEye: {
    paddingRight: 44,
  },
  eyeButton: {
    position: "absolute",
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButton: {
    borderRadius: 16,
    padding: 15,
    alignItems: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  submitButtonIdle: {
    backgroundColor: "#e8e8e8",
  },
  submitButtonActive: {
    backgroundColor: "#192939",
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  submitButtonTextIdle: {
    color: "#aaa",
  },
  submitButtonTextActive: {
    color: "#ffffff",
  },
  error: {
    color: "#d94f4f",
    textAlign: "center",
    marginBottom: 14,
    fontSize: 14,
  },
  link: {
    marginTop: 16,
    alignItems: "center",
    
  },
  linkText: {
    color: "#6b8f71",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionLabel: {
    color: "#999",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  classItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e5e5",
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#ccc",
    marginRight: 12,
  },
  checkboxSelected: {
    backgroundColor: "#6b8f71",
    borderColor: "#6b8f71",
  },
  classItemText: {
    fontSize: 15,
    color: "#222",
    flex: 1,
  },
});
