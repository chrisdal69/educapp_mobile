import { Text as RNText, TextProps, StyleSheet } from "react-native";

const weightToFamily: Record<string, string> = {
  "100": "Inter_300Light",
  "200": "Inter_300Light",
  "300": "Inter_300Light",
  "400": "Inter_400Regular",
  normal: "Inter_400Regular",
  "500": "Inter_500Medium",
  "600": "Inter_600SemiBold",
  "700": "Inter_700Bold",
  bold: "Inter_700Bold",
  "800": "Inter_700Bold",
  "900": "Inter_700Bold",
};

export default function AppText({ style, ...props }: TextProps) {
  const flat = StyleSheet.flatten(style) ?? {};
  const fontFamily =
    flat.fontFamily ??
    weightToFamily[String(flat.fontWeight ?? "400")] ??
    "Inter_400Regular";
  return <RNText style={[style, { fontFamily }]} {...props} />;
}
