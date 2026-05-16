export type ThemeColors = {
  bg: string;
  surface: string;
  cardBg: string;
  primary: string;
  text: string;
  textSecondary: string;
  muted: string;
  border: string;
  description: string;  
  documents: string;
  quizz: string;
  flash: string;
  cloud: string;
  video: string;
  boutonyes: string,
  boutonno: string,  
};

const dark: ThemeColors = {
  bg: "#161D1D",
  surface: "#1e2227",
  cardBg: "#2a3040",
  primary: "#f0f4f3",
  text: "#ffffff",  
  muted: "#888888",
  border: "#333940",
  textSecondary: "#eeeeee",

  description: "#A2C639",  
  documents: "#4D7C8A",
  quizz: "#66784d",
  flash: "#8FAD88",
  cloud: "#A2C639",
  video: "#7F9C96",
  boutonyes: "#152e1d",
  boutonno: "#746f18",  
  
};

const light: ThemeColors = {
  bg: "#F7F8F8",
  surface: "#ffffff",
  cardBg: "#e8efee",
  primary: "#30675f",
  text: "#111111",
  muted: "#888888",
  border: "#e0e0e0", 
  textSecondary: "#444444",
 
  description: "#ddd3cb",  
  documents: "#797084",
  quizz: "#8b90a4",
  flash: "#cecfd7",
  cloud: "#ddd3cb",
  video: "#b3cdcc",
  boutonyes: "#B8E5C3",
  boutonno: "#E5B8B9",
};

export const themes = { dark, light };
