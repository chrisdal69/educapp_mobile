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
  bgdescription: string;  
  bgdocuments: string;
  bgquizz: string;
  bgflash: string;
  bgcloud: string;
  bgvideo: string;
  boutonyes: string;
  boutonno: string;  
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

  bgdescription: "hsl(75.32, 55.29%,3%)",  
  bgdocuments: "hsl(193.77, 28.37%, 5%)",
  bgquizz: "hsl(85.12, 21.83%, 5%)",
  bgflash: "hsl(108.65, 18.41%, 5%)",
  bgcloud: "hsl(75.32, 55.29%, 5%)",
  bgvideo: "hsl(167.59, 12.78%, 5%)",

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

 bgdescription: "hsl(26.67, 20.93%, 96%)",  
  bgdocuments: "hsl(267, 8.2%, 91%)",
  bgquizz: "hsl(228, 12.08%, 94%)",
  bgflash: "hsl(233.33, 10.11%, 94%)",
  bgcloud: "hsl(26.67, 20.93%, 95%)",
  bgvideo: "hsl(177.69, 20.63%, 95%)",


  boutonyes: "#B8E5C3",
  boutonno: "#E5B8B9",
};

export const themes = { dark, light };
