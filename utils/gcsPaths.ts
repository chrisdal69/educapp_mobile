const BUCKET = "educapp";
const ENV_FOLDER = __DEV__ ? "eap-test" : "eap";

function toMobileFilename(bg: string): string {
  const lastDot = bg.lastIndexOf(".");
  if (lastDot === -1) return `${bg}Mobile`;
  return `${bg.slice(0, lastDot)}Mobile${bg.slice(lastDot)}`;
}

export function buildCardBgUrl({
  directoryname,
  repertoire,
  num,
  bg,
  mobile = true,
}: {
  directoryname: string;
  repertoire: string;
  num: number;
  bg: string;
  mobile?: boolean;
}): string {
  if (!directoryname || !repertoire || !bg) return "";
  const base = `https://storage.googleapis.com/${BUCKET}/${ENV_FOLDER}/${directoryname}/${repertoire}/tag${num}`;
  return `${base}/${mobile ? toMobileFilename(bg) : bg}`;
}
