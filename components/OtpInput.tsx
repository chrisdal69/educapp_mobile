import { useRef } from "react";
import { StyleSheet, TextInput, View } from "react-native";

type Props = {
  value: string;
  onChange: (val: string) => void;
  length?: number;
  disabled?: boolean;
  caseTransform?: "upper" | "none";
};

export default function OtpInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  caseTransform = "upper",
}: Props) {
  const refs = useRef<(TextInput | null)[]>([]);
  const chars = Array.from({ length }, (_, i) => value[i] ?? "");

  function handleChange(index: number, text: string) {
    const raw = caseTransform === "upper" ? text.toUpperCase() : text;
    const clean = raw.replace(/[^A-Za-z0-9]/g, "");

    if (clean.length === 0) {
      const next = [...chars];
      next[index] = "";
      onChange(next.join(""));
      return;
    }

    // Handle paste (multiple chars)
    const next = [...chars];
    let wi = index;
    for (const c of clean) {
      if (wi >= length) break;
      next[wi++] = c;
    }
    onChange(next.join(""));
    refs.current[Math.min(wi, length - 1)]?.focus();
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !chars[index] && index > 0) {
      const next = [...chars];
      next[index - 1] = "";
      onChange(next.join(""));
      refs.current[index - 1]?.focus();
    }
  }

  return (
    <View style={styles.row}>
      {chars.map((ch, i) => (
        <TextInput
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          style={styles.box}
          value={ch}
          onChangeText={(text) => handleChange(i, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          maxLength={2}
          editable={!disabled}
          autoFocus={i === 0}
          autoCapitalize={caseTransform === "upper" ? "characters" : "none"}
          autoCorrect={false}
          selectTextOnFocus
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 12 },
  box: {
    width: 52,
    height: 56,
    backgroundColor: "#333940",
    color: "#fff",
    borderRadius: 8,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
  },
});
