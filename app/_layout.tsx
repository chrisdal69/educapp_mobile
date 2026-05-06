import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { AuthProvider, useAuth } from "../contexts/AuthContext";

function RootLayoutNav() {
  const { user, isReady } = useAuth();
  const router = useRouter();
  const segments = useSegments() as string[];

  useEffect(() => {
    if (!isReady) return;
    const onLoginScreen = segments[0] === "login";
    if (!user && !onLoginScreen) {
      router.replace("/login");
    } else if (user && onLoginScreen) {
      router.replace("/(tabs)");
    }
  }, [user, isReady]);

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
