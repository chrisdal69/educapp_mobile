import React, { createContext, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { useColorScheme } from "react-native";
import { themes, ThemeColors } from "../theme";

type ThemeContextType = {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType>({
  isDark: true,
  colors: themes.dark,
  toggleTheme: () => {},
});

const STORAGE_KEY = "app_theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState<boolean>(systemScheme !== "light");

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((stored) => {
        if (stored === "light") setIsDark(false);
        else if (stored === "dark") setIsDark(true);
        // null → on garde la préférence système
      })
      .catch(() => {});
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    SecureStore.setItemAsync(STORAGE_KEY, next ? "dark" : "light").catch(() => {});
  }

  return (
    <ThemeContext.Provider
      value={{ isDark, colors: isDark ? themes.dark : themes.light, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
