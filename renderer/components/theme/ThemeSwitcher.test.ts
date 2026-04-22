/**
 * Inline tests for ThemeSwitcher / theme subsystem.
 *
 * Run with:  npx tsx components/theme/ThemeSwitcher.test.ts
 * Or via a test runner (vitest/jest) if configured.
 */

import { THEMES, DEFAULT_THEME, buildThemeCss, type ThemeId } from "@/lib/theme/themes";

// ─── Micro-test harness ───────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok =
    typeof expected === "function"
      ? (expected as (v: unknown) => boolean)(actual)
      : actual === expected;
  if (ok) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    console.error(`     actual:   ${JSON.stringify(actual)}`);
    console.error(`     expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

function suite(name: string, fn: () => void) {
  console.log(`\n── ${name}`);
  fn();
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite("THEMES catalogue", () => {
  const ids = Object.keys(THEMES) as ThemeId[];

  expect("has exactly 4 themes", ids.length, 4);
  expect("contains 'dark'", ids.includes("dark"), true);
  expect("contains 'neon'", ids.includes("neon"), true);
  expect("contains 'paper'", ids.includes("paper"), true);
  expect("contains 'minimal'", ids.includes("minimal"), true);
  expect("default theme is 'dark'", DEFAULT_THEME, "dark");
});

suite("Each theme has required token fields", () => {
  const REQUIRED_FIELDS: (keyof import("@/lib/theme/themes").ThemeTokens)[] = [
    "bgBase",
    "bgPanel",
    "bgPanel2",
    "bgGrid",
    "accent",
    "accentAlt",
    "text",
    "textMuted",
    "border",
    "borderGlow",
    "shadow",
    "scrollbarThumb",
  ];

  for (const [id, theme] of Object.entries(THEMES)) {
    for (const field of REQUIRED_FIELDS) {
      expect(
        `theme '${id}' has '${field}'`,
        typeof theme.tokens[field] === "string" && theme.tokens[field].length > 0,
        true,
      );
    }
  }
});

suite("Each theme has label, icon, htmlClass", () => {
  for (const [id, theme] of Object.entries(THEMES)) {
    expect(`theme '${id}' has label`, typeof theme.label === "string" && theme.label.length > 0, true);
    expect(`theme '${id}' has icon`, typeof theme.icon === "string" && theme.icon.length > 0, true);
    expect(
      `theme '${id}' has htmlClass 'theme-${id}'`,
      theme.htmlClass,
      `theme-${id}`,
    );
  }
});

suite("buildThemeCss output", () => {
  const tokens = THEMES.dark.tokens;
  const css = buildThemeCss(tokens);

  expect("contains --ut-bg-base", css.includes("--ut-bg-base:"), true);
  expect("contains --ut-accent", css.includes("--ut-accent:"), true);
  expect("contains --ut-text-muted", css.includes("--ut-text-muted:"), true);
  expect("contains --ut-shadow", css.includes("--ut-shadow:"), true);
  expect("contains dark bgBase value", css.includes(tokens.bgBase), true);
  expect("is a non-empty string", css.length > 50, true);
});

suite("neon theme has cyan accent (distinct from dark purple)", () => {
  expect(
    "neon accent != dark accent",
    THEMES.neon.tokens.accent !== THEMES.dark.tokens.accent,
    true,
  );
  expect("neon accent contains '#22e8ff'", THEMES.neon.tokens.accent, "#22e8ff");
});

suite("paper theme is light-background", () => {
  // Paper bg should start with #f or #e (light colors)
  const bg = THEMES.paper.tokens.bgBase.toLowerCase();
  expect(
    "paper bgBase is light-ish",
    bg.startsWith("#f") || bg.startsWith("#e"),
    true,
  );
});

suite("minimal theme is near-black", () => {
  const bg = THEMES.minimal.tokens.bgBase.toLowerCase();
  expect("minimal bgBase is dark (#1 or #0)", bg.startsWith("#1") || bg.startsWith("#0"), true);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(40)}`);
console.log(`ThemeSwitcher tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
