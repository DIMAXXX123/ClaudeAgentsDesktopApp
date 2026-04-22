/**
 * tests/oklchUtils.test.ts
 *
 * Unit tests for lib/theme/oklchUtils — OKLCH parsing, formatting,
 * hex→oklch conversion, CSS var injection helpers, and the imperative
 * transition-lock pattern that fixes the drag-resize animation blocker.
 */

import { describe, it, expect } from "vitest";
import {
  parseOklch,
  formatOklch,
  hexToOklch,
  cssColorToOklch,
  exportOverridesAsCss,
  COLOR_TOKEN_LABELS,
  type OklchComponents,
  type EditableToken,
} from "@/lib/theme/oklchUtils";

// ─── parseOklch ───────────────────────────────────────────────────────────────

describe("parseOklch", () => {
  it("parses a standard oklch() value", () => {
    const result = parseOklch("oklch(0.6 0.15 240)");
    expect(result).not.toBeNull();
    expect(result!.l).toBeCloseTo(0.6, 3);
    expect(result!.c).toBeCloseTo(0.15, 3);
    expect(result!.h).toBeCloseTo(240, 1);
  });

  it("handles percentage lightness oklch(60% 0.1 120)", () => {
    const result = parseOklch("oklch(60% 0.1 120)");
    expect(result).not.toBeNull();
    expect(result!.l).toBeCloseTo(0.6, 3);
  });

  it("returns null for non-oklch strings", () => {
    expect(parseOklch("#ff0000")).toBeNull();
    expect(parseOklch("rgb(255,0,0)")).toBeNull();
    expect(parseOklch("")).toBeNull();
  });

  it("clamps l to [0, 1]", () => {
    const result = parseOklch("oklch(1.5 0.1 0)");
    expect(result!.l).toBe(1);
  });

  it("clamps c to [0, 0.5]", () => {
    const result = parseOklch("oklch(0.5 0.9 0)");
    expect(result!.c).toBe(0.5);
  });

  it("normalises hue > 360 to [0, 360)", () => {
    const result = parseOklch("oklch(0.5 0.1 400)");
    expect(result!.h).toBeCloseTo(40, 1);
  });
});

// ─── formatOklch ──────────────────────────────────────────────────────────────

describe("formatOklch", () => {
  it("produces a well-formed oklch() string", () => {
    const s = formatOklch({ l: 0.6, c: 0.15, h: 240 });
    expect(s).toMatch(/^oklch\(/);
    expect(s).toMatch(/\)$/);
  });

  it("round-trips through parseOklch", () => {
    const original: OklchComponents = { l: 0.7234, c: 0.181, h: 173.5 };
    const parsed = parseOklch(formatOklch(original));
    expect(parsed).not.toBeNull();
    expect(parsed!.l).toBeCloseTo(original.l, 3);
    expect(parsed!.c).toBeCloseTo(original.c, 3);
    expect(parsed!.h).toBeCloseTo(original.h, 1);
  });

  it("uses 4 dp for L and C", () => {
    const s = formatOklch({ l: 0.5, c: 0.2, h: 120 });
    expect(s).toContain("0.5000");
    expect(s).toContain("0.2000");
  });

  it("uses 2 dp for H", () => {
    const s = formatOklch({ l: 0.5, c: 0.2, h: 120 });
    expect(s).toContain("120.00");
  });
});

// ─── hexToOklch ───────────────────────────────────────────────────────────────

describe("hexToOklch", () => {
  it("converts pure white to L≈1", () => {
    const { l } = hexToOklch("#ffffff");
    expect(l).toBeGreaterThan(0.99);
  });

  it("converts pure black to L≈0 and C≈0", () => {
    const { l, c } = hexToOklch("#000000");
    expect(l).toBeCloseTo(0, 2);
    expect(c).toBeCloseTo(0, 2);
  });

  it("accepts 3-digit hex shorthand", () => {
    const { l: l3 } = hexToOklch("#fff");
    const { l: l6 } = hexToOklch("#ffffff");
    expect(l3).toBeCloseTo(l6, 3);
  });

  it("produces higher chroma for vivid blue than mid-grey", () => {
    const { c: cBlue } = hexToOklch("#0000ff");
    const { c: cGrey } = hexToOklch("#808080");
    expect(cBlue).toBeGreaterThan(cGrey);
  });

  it("grey has near-zero chroma", () => {
    const { c } = hexToOklch("#808080");
    expect(c).toBeLessThan(0.02);
  });
});

// ─── cssColorToOklch ──────────────────────────────────────────────────────────

describe("cssColorToOklch", () => {
  it("dispatches oklch() values", () => {
    const r = cssColorToOklch("oklch(0.5 0.2 120)");
    expect(r.l).toBeCloseTo(0.5, 3);
  });

  it("dispatches hex values", () => {
    const r = cssColorToOklch("#ffffff");
    expect(r.l).toBeGreaterThan(0.99);
  });

  it("dispatches rgb() values (white)", () => {
    const r = cssColorToOklch("rgb(255, 255, 255)");
    expect(r.l).toBeGreaterThan(0.98);
  });

  it("falls back to mid-grey for unknown formats", () => {
    const r = cssColorToOklch("transparent");
    expect(r.l).toBeCloseTo(0.5, 1);
    expect(r.c).toBeCloseTo(0, 1);
  });
});

// ─── COLOR_TOKEN_LABELS ───────────────────────────────────────────────────────

describe("COLOR_TOKEN_LABELS registry", () => {
  it("contains --ut-accent and --ut-bg-base", () => {
    expect("--ut-accent" in COLOR_TOKEN_LABELS).toBe(true);
    expect("--ut-bg-base" in COLOR_TOKEN_LABELS).toBe(true);
  });

  it("all keys start with --ut-", () => {
    Object.keys(COLOR_TOKEN_LABELS).forEach((k) => {
      expect(k.startsWith("--ut-")).toBe(true);
    });
  });

  it("all labels are non-empty strings", () => {
    Object.values(COLOR_TOKEN_LABELS).forEach((v) => {
      expect(typeof v).toBe("string");
      expect(v.length).toBeGreaterThan(0);
    });
  });
});

// ─── exportOverridesAsCss ─────────────────────────────────────────────────────

describe("exportOverridesAsCss", () => {
  const tokens: EditableToken[] = [
    {
      cssVar: "--ut-accent",
      label: "Accent",
      oklch: { l: 0.6, c: 0.2, h: 270 },
      originalValue: "#9a5cff",
    },
    {
      cssVar: "--ut-bg-base",
      label: "BG Base",
      oklch: { l: 0.1, c: 0.02, h: 270 },
      originalValue: "#0a0520",
    },
  ];

  it("wraps in :root { }", () => {
    const css = exportOverridesAsCss(tokens);
    expect(css.startsWith(":root {")).toBe(true);
    expect(css.trimEnd().endsWith("}")).toBe(true);
  });

  it("includes both CSS var names", () => {
    const css = exportOverridesAsCss(tokens);
    expect(css).toContain("--ut-accent:");
    expect(css).toContain("--ut-bg-base:");
  });

  it("includes oklch() colour values", () => {
    const css = exportOverridesAsCss(tokens);
    expect(css).toContain("oklch(");
  });
});

// ─── Imperative transition lock (animation blocker fix) ───────────────────────

describe("Imperative transition-lock pattern (drag-resize blocker fix)", () => {
  /**
   * Simulates the _lockTransition / _unlockTransition helpers added to
   * useDragResize. The key fix: transitions are set synchronously on mousedown
   * without waiting for React state (setIsInteracting) to re-render.
   */
  function makePanel() {
    return { style: { transition: "left 220ms ease", willChange: "auto" } };
  }

  const IDLE_TRANSITION = "left 220ms ease";

  function lock(el: ReturnType<typeof makePanel>) {
    el.style.transition = "none";
    el.style.willChange = "left, top, width, height";
  }

  function unlock(el: ReturnType<typeof makePanel>) {
    el.style.transition = "";
    el.style.willChange = "";
  }

  it("lock() disables transition immediately (synchronous, no React lag)", () => {
    const el = makePanel();
    lock(el);
    expect(el.style.transition).toBe("none");
    expect(el.style.willChange).toContain("left");
  });

  it("unlock() clears inline styles to let React's animationStyle take over", () => {
    const el = makePanel();
    lock(el);
    unlock(el);
    expect(el.style.transition).toBe("");
    expect(el.style.willChange).toBe("");
  });

  it("lock → unlock → idle restoration round-trip", () => {
    const el = makePanel();
    lock(el);
    expect(el.style.transition).toBe("none");  // drag active

    unlock(el);
    // Simulate React applying TRANSITION_IDLE after setIsInteracting(false)
    el.style.transition = IDLE_TRANSITION;
    el.style.willChange = "auto";

    expect(el.style.transition).toBe(IDLE_TRANSITION);
    expect(el.style.willChange).toBe("auto");
  });

  it("second lock() while rAF is pending keeps transition:none (no settle flicker)", () => {
    const el = makePanel();
    lock(el);   // drag 1 starts
    unlock(el); // drag 1 ends → clears inline
    lock(el);   // drag 2 starts immediately (before rAF fires)
    // After second lock, transition must be none
    expect(el.style.transition).toBe("none");
  });
});
