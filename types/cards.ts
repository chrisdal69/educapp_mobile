export type CardHref = {
  txt: string;
  href: string;
  hover?: string;
  visible?: boolean;
};

export type CardQuizz = {
  id: string;
  question: string;
  image?: string;
  options: string[];
  correct: number;
};

export type CardFlash = {
  id: string;
  question: string;
  imquestion?: string;
  reponse: string;
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
