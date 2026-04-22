export type ThemeId = "dark" | "neon" | "paper" | "minimal";

export interface ThemeTokens {
  bgBase: string;
  bgPanel: string;
  bgPanel2: string;
  bgGrid: string;
  accent: string;
  accentAlt: string;
  text: string;
  textMuted: string;
  border: string;
  borderGlow: string;
  shadow: string;
  scrollbarThumb: string;
}

export interface Theme {
  id: ThemeId;
  label: string;
  icon: string;
  tokens: ThemeTokens;
  /** CSS class(es) to add to <html> element */
  htmlClass: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  dark: {
    id: "dark",
    label: "Dark",
    icon: "🌑",
    htmlClass: "theme-dark",
    tokens: {
      bgBase: "#0a0520",
      bgPanel: "#13082b",
      bgPanel2: "#1b0f3a",
      bgGrid: "#1e1240",
      accent: "#9a5cff",
      accentAlt: "#22e8ff",
      text: "#e9e4ff",
      textMuted: "#7060a0",
      border: "rgba(154,92,255,0.5)",
      borderGlow: "rgba(154,92,255,0.2)",
      shadow: "0 0 12px rgba(154,92,255,0.2)",
      scrollbarThumb: "#3a1e6e",
    },
  },

  neon: {
    id: "neon",
    label: "Neon",
    icon: "⚡",
    htmlClass: "theme-neon",
    tokens: {
      bgBase: "#050a14",
      bgPanel: "#081020",
      bgPanel2: "#0c1828",
      bgGrid: "#0d1e30",
      accent: "#22e8ff",
      accentAlt: "#ff4adf",
      text: "#d0f4ff",
      textMuted: "#3a7090",
      border: "rgba(34,232,255,0.6)",
      borderGlow: "rgba(34,232,255,0.3)",
      shadow: "0 0 16px rgba(34,232,255,0.3), 0 0 32px rgba(34,232,255,0.1)",
      scrollbarThumb: "#1a4060",
    },
  },

  paper: {
    id: "paper",
    label: "Paper",
    icon: "📄",
    htmlClass: "theme-paper",
    tokens: {
      bgBase: "#f5f0e8",
      bgPanel: "#ede8de",
      bgPanel2: "#e4ddd0",
      bgGrid: "#ddd6c8",
      accent: "#7c4a2d",
      accentAlt: "#2d6e7c",
      text: "#1a1208",
      textMuted: "#7a6a54",
      border: "rgba(124,74,45,0.4)",
      borderGlow: "rgba(124,74,45,0.1)",
      shadow: "0 2px 8px rgba(0,0,0,0.12)",
      scrollbarThumb: "#b8a890",
    },
  },

  minimal: {
    id: "minimal",
    label: "Minimal",
    icon: "◼",
    htmlClass: "theme-minimal",
    tokens: {
      bgBase: "#111111",
      bgPanel: "#1a1a1a",
      bgPanel2: "#222222",
      bgGrid: "#282828",
      accent: "#e0e0e0",
      accentAlt: "#888888",
      text: "#f0f0f0",
      textMuted: "#666666",
      border: "rgba(255,255,255,0.12)",
      borderGlow: "rgba(255,255,255,0.04)",
      shadow: "0 1px 4px rgba(0,0,0,0.6)",
      scrollbarThumb: "#333333",
    },
  },
};

export const DEFAULT_THEME: ThemeId = "dark";

/** Build a CSS string that sets all --ut-* custom properties */
export function buildThemeCss(tokens: ThemeTokens): string {
  return [
    `--ut-bg-base: ${tokens.bgBase};`,
    `--ut-bg-panel: ${tokens.bgPanel};`,
    `--ut-bg-panel2: ${tokens.bgPanel2};`,
    `--ut-bg-grid: ${tokens.bgGrid};`,
    `--ut-accent: ${tokens.accent};`,
    `--ut-accent-alt: ${tokens.accentAlt};`,
    `--ut-text: ${tokens.text};`,
    `--ut-text-muted: ${tokens.textMuted};`,
    `--ut-border: ${tokens.border};`,
    `--ut-border-glow: ${tokens.borderGlow};`,
    `--ut-shadow: ${tokens.shadow};`,
    `--ut-scrollbar-thumb: ${tokens.scrollbarThumb};`,
  ].join(" ");
}
