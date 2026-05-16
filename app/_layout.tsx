import { useEffect } from "react";
import { Text } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

(Text as any).defaultProps = { style: { fontFamily: "Inter_400Regular" } };
import { useFonts, Inter_300Light, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { ThemeProvider } from "../contexts/ThemeContext";

const PUBLIC_SCREENS = ["login", "forgot", "signup"];

function RootLayoutNav() {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    if (!isReady) return;
    const onPublic = PUBLIC_SCREENS.includes(segments[0]);
    if (!user && !onPublic) {
      router.replace("/login");
    } else if (user && segments[0] === "login") {
      router.replace("/(tabs)");
    }
  }, [user, isReady]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="forgot" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="changepassword" options={{ headerShown: false }} />
      <Stack.Screen name="changemail" options={{ headerShown: false }} />
      <Stack.Screen name="leaveclass" options={{ headerShown: false }} />
      <Stack.Screen name="deleteaccount" options={{ headerShown: false }} />
      <Stack.Screen name="manageclass" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Inter_300Light,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
