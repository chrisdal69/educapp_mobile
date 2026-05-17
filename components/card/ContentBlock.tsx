import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useState, useMemo } from "react";
import WebView from "react-native-webview";
import katex from "katex";
import { useTheme } from "@/contexts/ThemeContext";
import type { Card } from "@/types/cards";

// --- Types Slate ---

type SlateLeaf = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
};

type SlateElement = {
  type: string;
  align?: string;
  children: SlateNode[];
};

type SlateNode = SlateLeaf | SlateElement;

// --- Helpers ---

function isLeaf(node: SlateNode): node is SlateLeaf {
  return typeof (node as SlateLeaf).text === "string";
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Transforme $...$ en MathML via katex (pré-rendu côté RN, 100% offline)
function renderInlineMath(text: string): string {
  const result: string[] = [];
  const chars = Array.from(text);
  let buffer = "";
  let inMath = false;

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];

    if (char === "\\" && chars[i + 1] === "$") {
      buffer += "$";
      i++;
      continue;
    }

    if (char === "$") {
      if (inMath) {
        if (buffer.length === 0) {
          result.push(escapeHtml("$$"));
        } else {
          try {
            result.push(
              katex.renderToString(buffer, {
                output: "mathml",
                throwOnError: false,
              })
            );
          } catch {
            result.push(escapeHtml(`$${buffer}$`));
          }
        }
        buffer = "";
        inMath = false;
      } else {
        if (buffer.length > 0) result.push(escapeHtml(buffer));
        buffer = "";
        inMath = true;
      }
      continue;
    }

    buffer += char;
  }

  if (inMath) {
    result.push(escapeHtml(`$${buffer}`));
  } else if (buffer.length > 0) {
    result.push(escapeHtml(buffer));
  }

  return result.join("");
}

// --- Convertisseur Slate → HTML ---

function leafToHtml(leaf: SlateLeaf): string {
  let html = renderInlineMath(leaf.text);
  if (leaf.bold) html = `<strong>${html}</strong>`;
  if (leaf.italic) html = `<em>${html}</em>`;
  if (leaf.underline) html = `<u>${html}</u>`;
  return html;
}

function nodeToHtml(node: SlateNode): string {
  if (isLeaf(node)) return leafToHtml(node);
  const el = node as SlateElement;
  const children = (el.children ?? []).map(nodeToHtml).join("");
  const align = el.align ? ` style="text-align:${el.align}"` : "";
  switch (el.type) {
    case "bulleted-list":
      return `<ul>${children}</ul>`;
    case "numbered-list":
      return `<ol>${children}</ol>`;
    case "list-item":
      return `<li${align}>${children}</li>`;
    default:
      return `<p${align}>${children || "&nbsp;"}</p>`;
  }
}

function buildHtml(nodes: SlateNode[], bg: string, textColor: string): string {
  const body = nodes.map(nodeToHtml).join("");
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      font-family:-apple-system,system-ui,'Helvetica Neue',sans-serif;
      font-size:19px;line-height:1.75;
      padding:20px 16px;
      background-color:${bg};
      color:${textColor};
    }
    p{margin-bottom:20px}
    ul,ol{margin-left:24px;margin-bottom:14px}
    li{margin-bottom:6px}
    math{font-size:1.1em}
  </style>
</head>
<body>${body}</body>
</html>`;
}

// --- Composant ---

type Props = { card: Card; onClose: () => void };

const DEFAULT_CONTENT: SlateNode[] = [
  { type: "paragraph", children: [{ text: "Aucun contenu disponible." }] },
];

export default function ContentBlock({ card }: Props) {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);

  const content: SlateNode[] =
    Array.isArray(card.content) && card.content.length > 0
      ? (card.content as SlateNode[])
      : DEFAULT_CONTENT;

  const html = useMemo(
    () => buildHtml(content, colors.bgdescription, colors.text),
    [card._id, colors.bgdescription, colors.text]
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.bgdescription }]}>
      {loading && (
        <ActivityIndicator
          style={StyleSheet.absoluteFillObject}
          color={colors.primary}
        />
      )}
      <WebView
        source={{ html }}
        style={[styles.webview, loading && styles.hidden]}
        scrollEnabled
        showsVerticalScrollIndicator={false}
        originWhitelist={["*"]}
        onLoad={() => setLoading(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webview: { flex: 1, backgroundColor: "transparent" },
  hidden: { opacity: 0 },
});
