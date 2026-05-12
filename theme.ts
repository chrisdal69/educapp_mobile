export type ThemeColors = {
  bg: string;
  surface: string;
  cardBg: string;
  primary: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  danger: string;
  dangerBg: string;
  badge: string;
};

const dark: ThemeColors = {
  bg: "#25292e",
  surface: "#1e2227",
  cardBg: "#2a3040",
  primary: "#ffd33d",
  text: "#ffffff",
  textSecondary: "#cccccc",
  muted: "#888888",
  border: "#333940",
  danger: "#ff6b6b",
  dangerBg: "#2a1a1a",
  badge: "#2a3040",
};

const light: ThemeColors = {
  bg: "#f0f4f3",
  surface: "#ffffff",
  cardBg: "#e8efee",
  primary: "#30675f",
  text: "#111111",
  textSecondary: "#444444",
  muted: "#888888",
  border: "#e0e0e0",
  danger: "#d94f4f",
  dangerBg: "#fdf0f0",
  badge: "#deeae8",
};

export const themes = { dark, light };
