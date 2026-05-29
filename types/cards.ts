export type CardHref = {
  txt: string;
  href: string;
  hover?: string;
  duration?: number | null;
  visible?: boolean;
};

export type CardQuizz = {
  id: string;
  question: string | any[];
  image?: string;
  options: string[];
  correct: number;
};

export type CardFlash = {
  id: string;
  question: string | any[];
  imquestion?: string;
  reponse: string | any[];
  imreponse?: string;
};

export type Card = {
  _id: string;
  num: number;
  repertoire: string;
  cloud?: boolean;
  bg?: string;
  titre: string;
  content: any[];
  contentVersion?: number;
  fichiers: CardHref[];
  quizz: CardQuizz[];
  flash: CardFlash[];
  video: CardHref[];
  nbUserFiles?: number;
  nbUserFlashes?: number;
  evalQuizz?: string;
  resultatQuizz?: boolean;
  visible?: boolean;
  order: number;
  classe: string;
};

export type UserFileEntry = {
  name: string;
  filename: string;
  date: string;
  url: string;
};

export type ClasseRepertoire = {
  repertoire: string;
  bgcolor: string;
  primary: string;
  selectedBg: string;
};
