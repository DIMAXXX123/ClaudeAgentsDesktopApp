/**
 * Minimal ANSI to HTML parser for console output.
 * Supports colors 30-37 (black-white), 90-97 (bright), bold/reset.
 */

interface Token {
  type: "text" | "color" | "bold" | "reset";
  value: string;
}

const ANSI_PATTERN = /\x1b\[([0-9;]*?)m/g;

const COLORS: Record<number, string> = {
  30: "#808080",
  31: "#ff6b6b",
  32: "#51cf66",
  33: "#ffd43b",
  34: "#74c0fc",
  35: "#da77f2",
  36: "#22d3ee",
  37: "#ffffff",
  90: "#808080",
  91: "#ff8787",
  92: "#69db7c",
  93: "#ffe066",
  94: "#a5d8ff",
  95: "#e599f7",
  96: "#38b6d0",
  97: "#f8f9fa",
};

export function parseAnsi(text: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = ANSI_PATTERN.exec(text))) {
    if (match.index > lastIndex) {
      tokens.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }

    const codes = match[1].split(";").map((c) => parseInt(c, 10)).filter((n) => !isNaN(n));

    for (const code of codes) {
      if (code === 1) {
        tokens.push({ type: "bold", value: "" });
      } else if (code === 0) {
        tokens.push({ type: "reset", value: "" });
      } else if (code in COLORS) {
        tokens.push({ type: "color", value: COLORS[code] });
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return tokens;
}

export function ansiToHtml(text: string): string {
  const tokens = parseAnsi(text);
  let html = "";
  let currentColor: string | null = null;
  let isBold = false;

  for (const token of tokens) {
    if (token.type === "text") {
      const escaped = token.value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

      if (currentColor || isBold) {
        let style = "";
        if (currentColor) style += `color: ${currentColor};`;
        if (isBold) style += "font-weight: bold;";
        html += `<span style="${style}">${escaped}</span>`;
      } else {
        html += escaped;
      }
    } else if (token.type === "color") {
      currentColor = token.value;
    } else if (token.type === "bold") {
      isBold = true;
    } else if (token.type === "reset") {
      currentColor = null;
      isBold = false;
    }
  }

  return html;
}
