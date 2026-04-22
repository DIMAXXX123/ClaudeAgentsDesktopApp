/**
 * oklchUtils — OKLCH color helpers for the live token editor
 *
 * OKLCH (Lightness Chroma Hue) is natively supported in modern browsers via
 * `oklch(L C H)` CSS syntax. This module provides:
 *   - Parsing an oklch() string or a hex color into OklchComponents
 *   - Formatting OklchComponents back to a CSS oklch() string
 *   - Injecting / restoring CSS custom properties on the document root
 *   - A registry of which --ut-* tokens are color vs non-color
 *
 * No external deps — uses only native browser CSS color parsing.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OklchComponents {
  /** Lightness  0–1 */
  l: number;
  /** Chroma     0–0.4  (typical range; CSS allows 0–∞ but display clips) */
  c: number;
  /** Hue        0–360 degrees */
  h: number;
}

/** A token that the editor can control */
export interface EditableToken {
  /** CSS custom property name, e.g. "--ut-accent" */
  cssVar: string;
  /** Human-readable label */
  label: string;
  /** Current OKLCH components */
  oklch: OklchComponents;
  /** Original value string (hex or oklch) — to detect whether user-edited */
  originalValue: string;
}

// ─── OKLCH string parsing ─────────────────────────────────────────────────────

const OKLCH_RE =
  /oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)/i;

/**
 * Parse an `oklch(L C H)` CSS string into components.
 * Returns null if the string is not a recognisable oklch() value.
 */
export function parseOklch(value: string): OklchComponents | null {
  const m = OKLCH_RE.exec(value.trim());
  if (!m) return null;

  const rawL = m[1];
  const l = rawL.endsWith("%") ? parseFloat(rawL) / 100 : parseFloat(rawL);
  const c = parseFloat(m[2]);
  const h = parseFloat(m[3]);

  if ([l, c, h].some(Number.isNaN)) return null;
  return { l: clamp(l, 0, 1), c: clamp(c, 0, 0.5), h: ((h % 360) + 360) % 360 };
}

/**
 * Format OklchComponents to a CSS `oklch()` string.
 * Precision: L 4 dp, C 4 dp, H 2 dp — matches browser dev-tools output.
 */
export function formatOklch({ l, c, h }: OklchComponents): string {
  return `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})`;
}

// ─── Hex → approximate OKLCH conversion ──────────────────────────────────────
// Full sRGB→Linear→XYZ→Oklab→OKLCH pipeline for reasonable accuracy.

function hexToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearToOklab(r: number, g: number, b: number): [number, number, number] {
  // sRGB linear → LMS (Oklab pre-LMS matrix)
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/**
 * Convert a 6-digit hex colour (#rrggbb or #rgb) to approximate OKLCH.
 * Returns a default neutral grey if parsing fails.
 */
export function hexToOklch(hex: string): OklchComponents {
  const clean = hex.replace("#", "");
  let r = 0, g = 0, b = 0;

  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2), 16);
    g = parseInt(clean.slice(2, 4), 16);
    b = parseInt(clean.slice(4, 6), 16);
  }

  const rL = hexToLinear(r);
  const gL = hexToLinear(g);
  const bL = hexToLinear(b);

  const [L, a, bOklab] = linearToOklab(rL, gL, bL);
  const C = Math.sqrt(a * a + bOklab * bOklab);
  const H = ((Math.atan2(bOklab, a) * 180) / Math.PI + 360) % 360;

  return {
    l: clamp(L, 0, 1),
    c: clamp(C, 0, 0.5),
    h: H,
  };
}

// ─── Parse any CSS colour value to OKLCH ─────────────────────────────────────

/**
 * Parse a CSS colour string (hex or oklch) to OklchComponents.
 * Falls back to mid-grey for unrecognised formats.
 */
export function cssColorToOklch(value: string): OklchComponents {
  const trimmed = value.trim();

  // Try oklch() first
  const parsed = parseOklch(trimmed);
  if (parsed) return parsed;

  // Try hex
  if (trimmed.startsWith("#")) return hexToOklch(trimmed);

  // rgba / rgb — extract channels then treat as hex
  const rgbMatch = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(trimmed);
  if (rgbMatch) {
    return hexToOklch(
      "#" +
        [rgbMatch[1], rgbMatch[2], rgbMatch[3]]
          .map((n) => parseInt(n).toString(16).padStart(2, "0"))
          .join(""),
    );
  }

  // Fallback: neutral grey
  return { l: 0.5, c: 0, h: 0 };
}

// ─── CSS variable injection ───────────────────────────────────────────────────

/**
 * Names of --ut-* tokens that represent colours (editable in the OKLCH editor).
 * Non-colour tokens (shadow, border with rgba, scrollbarThumb) are included
 * only if they contain a parseable hex or oklch value.
 */
export const COLOR_TOKEN_LABELS: Record<string, string> = {
  "--ut-bg-base": "BG Base",
  "--ut-bg-panel": "BG Panel",
  "--ut-bg-panel2": "BG Panel Alt",
  "--ut-bg-grid": "BG Grid",
  "--ut-accent": "Accent",
  "--ut-accent-alt": "Accent Alt",
  "--ut-text": "Text",
  "--ut-text-muted": "Text Muted",
  "--ut-scrollbar-thumb": "Scrollbar",
};

/**
 * Read the current resolved value of a CSS custom property from :root.
 * Returns an empty string if called outside the browser.
 */
export function readCssVar(varName: string): string {
  if (typeof document === "undefined") return "";
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

/**
 * Inject a CSS custom property directly on document.documentElement.style.
 * This overrides the theme stylesheet without editing it.
 */
export function setCssVar(varName: string, value: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty(varName, value);
}

/**
 * Remove a per-element inline CSS override, restoring the theme stylesheet
 * value (i.e. reset to the active theme's token).
 */
export function resetCssVar(varName: string): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.removeProperty(varName);
}

/**
 * Inject an OKLCH value for a CSS custom property.
 * Uses native `oklch()` syntax — supported in all modern browsers.
 */
export function setOklchVar(varName: string, components: OklchComponents): void {
  setCssVar(varName, formatOklch(components));
}

/**
 * Build the initial list of editable tokens by reading current CSS var values.
 * Safe to call only on the client (accesses window/document).
 */
export function buildEditableTokens(): EditableToken[] {
  return Object.entries(COLOR_TOKEN_LABELS).map(([cssVar, label]) => {
    const rawValue = readCssVar(cssVar);
    const oklch = cssColorToOklch(rawValue);
    return { cssVar, label, oklch, originalValue: rawValue };
  });
}

/**
 * Export current inline overrides as a CSS snippet (for copy/paste).
 */
export function exportOverridesAsCss(tokens: EditableToken[]): string {
  const lines = tokens.map(
    ({ cssVar, oklch }) => `  ${cssVar}: ${formatOklch(oklch)};`,
  );
  return `:root {\n${lines.join("\n")}\n}`;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
