/**
 * tests/panelLayoutStore.test.ts
 *
 * Unit tests for the panel layout persistence engine.
 * Uses happy-dom environment (localStorage available via vitest config).
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  panelLayoutStore,
  defaultRect,
  type PanelRect,
} from "@/lib/theme/panelLayoutStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns a fresh unique panel ID per test to avoid cross-test bleed */
let _counter = 0;
function uid(prefix = "panel"): string {
  return `${prefix}-${++_counter}`;
}

function resetAll() {
  panelLayoutStore.resetAll();
  // Clear all presets by loading each and deleting
  const presets = panelLayoutStore.getPresets();
  presets.forEach((p) => panelLayoutStore.deletePreset(p.id));
  // Clear localStorage entirely for a clean slate
  if (typeof localStorage !== "undefined") {
    localStorage.clear();
  }
}

beforeEach(() => {
  resetAll();
});

// ─── defaultRect ─────────────────────────────────────────────────────────────

describe("defaultRect", () => {
  it("returns an object with x, y, w, h", () => {
    const r = defaultRect("my-panel", 0);
    expect(r).toMatchObject({ x: expect.any(Number), y: expect.any(Number), w: expect.any(Number), h: expect.any(Number) });
  });

  it("staggers panels by index", () => {
    const r0 = defaultRect("a", 0);
    const r1 = defaultRect("b", 1);
    expect(r1.x).toBeGreaterThan(r0.x);
  });

  it("wraps columns after 3 panels", () => {
    const r0 = defaultRect("a", 0);
    const r3 = defaultRect("d", 3);
    // Same column (0 % 3 === 3 % 3 === 0) but different row
    expect(r3.x).toBe(r0.x);
    expect(r3.y).toBeGreaterThan(r0.y);
  });
});

// ─── getRect / setRect ────────────────────────────────────────────────────────

describe("getRect / setRect", () => {
  it("returns default rect for unknown panel", () => {
    const id = uid();
    const r = panelLayoutStore.getRect(id, 0);
    expect(r).toEqual(defaultRect(id, 0));
  });

  it("persists a rect and returns it", () => {
    const id = uid();
    const rect: PanelRect = { x: 100, y: 200, w: 400, h: 300 };
    panelLayoutStore.setRect(id, rect);
    expect(panelLayoutStore.getRect(id)).toEqual(rect);
  });

  it("overwrites an existing rect", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 10, y: 10, w: 200, h: 150 });
    panelLayoutStore.setRect(id, { x: 50, y: 60, w: 250, h: 200 });
    expect(panelLayoutStore.getRect(id)).toEqual({ x: 50, y: 60, w: 250, h: 200 });
  });
});

// ─── movePanel ────────────────────────────────────────────────────────────────

describe("movePanel", () => {
  it("moves a panel by delta", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 100, y: 100, w: 200, h: 150 });
    panelLayoutStore.movePanel(id, 30, -20);
    const r = panelLayoutStore.getRect(id);
    expect(r.x).toBe(130);
    expect(r.y).toBe(80);
  });

  it("clamps x and y to >= 0", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 5, y: 5, w: 200, h: 150 });
    panelLayoutStore.movePanel(id, -100, -100);
    const r = panelLayoutStore.getRect(id);
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

// ─── resizePanel ─────────────────────────────────────────────────────────────

describe("resizePanel", () => {
  it("resizes by delta", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 0, y: 0, w: 300, h: 200 });
    panelLayoutStore.resizePanel(id, 50, 30);
    const r = panelLayoutStore.getRect(id);
    expect(r.w).toBe(350);
    expect(r.h).toBe(230);
  });

  it("clamps to minW and minH", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 0, y: 0, w: 300, h: 200 });
    panelLayoutStore.resizePanel(id, -500, -500, 160, 120);
    const r = panelLayoutStore.getRect(id);
    expect(r.w).toBe(160);
    expect(r.h).toBe(120);
  });
});

// ─── resetPanel ──────────────────────────────────────────────────────────────

describe("resetPanel", () => {
  it("removes saved position so getRect returns default", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 999, y: 999, w: 600, h: 400 });
    panelLayoutStore.resetPanel(id, 0);
    expect(panelLayoutStore.getRect(id, 0)).toEqual(defaultRect(id, 0));
  });
});

// ─── resetAll ────────────────────────────────────────────────────────────────

describe("resetAll", () => {
  it("clears all panel positions", () => {
    const id1 = uid();
    const id2 = uid();
    panelLayoutStore.setRect(id1, { x: 100, y: 100, w: 300, h: 200 });
    panelLayoutStore.setRect(id2, { x: 200, y: 200, w: 300, h: 200 });
    panelLayoutStore.resetAll();
    expect(panelLayoutStore.getRect(id1)).toEqual(defaultRect(id1));
    expect(panelLayoutStore.getRect(id2)).toEqual(defaultRect(id2));
  });
});

// ─── Presets ──────────────────────────────────────────────────────────────────

describe("savePreset", () => {
  it("creates a preset with correct layout snapshot", () => {
    const id = uid();
    const rect: PanelRect = { x: 50, y: 80, w: 320, h: 240 };
    panelLayoutStore.setRect(id, rect);
    const preset = panelLayoutStore.savePreset("My Layout");
    expect(preset.name).toBe("My Layout");
    expect(preset.layout[id]).toEqual(rect);
  });

  it("uses fallback name when none provided", () => {
    const preset = panelLayoutStore.savePreset("  ");
    expect(preset.name).toBeTruthy();
    expect(preset.id).toMatch(/^preset-/);
  });

  it("preset appears in getPresets()", () => {
    const preset = panelLayoutStore.savePreset("Test");
    const found = panelLayoutStore.getPresets().find((p) => p.id === preset.id);
    expect(found).toBeDefined();
  });
});

describe("loadPreset", () => {
  it("restores saved layout", () => {
    const id = uid();
    panelLayoutStore.setRect(id, { x: 10, y: 20, w: 300, h: 200 });
    const preset = panelLayoutStore.savePreset("Snapshot");

    // Change layout
    panelLayoutStore.setRect(id, { x: 999, y: 999, w: 100, h: 100 });

    // Restore
    const ok = panelLayoutStore.loadPreset(preset.id);
    expect(ok).toBe(true);
    expect(panelLayoutStore.getRect(id)).toEqual({ x: 10, y: 20, w: 300, h: 200 });
  });

  it("returns false for unknown preset id", () => {
    expect(panelLayoutStore.loadPreset("non-existent")).toBe(false);
  });
});

describe("deletePreset", () => {
  it("removes a preset from the list", () => {
    const preset = panelLayoutStore.savePreset("ToDelete");
    expect(panelLayoutStore.deletePreset(preset.id)).toBe(true);
    expect(panelLayoutStore.getPresets().find((p) => p.id === preset.id)).toBeUndefined();
  });

  it("returns false for unknown id", () => {
    expect(panelLayoutStore.deletePreset("ghost")).toBe(false);
  });
});

describe("renamePreset", () => {
  it("renames a preset", () => {
    const preset = panelLayoutStore.savePreset("Old Name");
    expect(panelLayoutStore.renamePreset(preset.id, "New Name")).toBe(true);
    const found = panelLayoutStore.getPresets().find((p) => p.id === preset.id);
    expect(found?.name).toBe("New Name");
  });

  it("keeps old name when new name is blank", () => {
    const preset = panelLayoutStore.savePreset("Original");
    panelLayoutStore.renamePreset(preset.id, "   ");
    const found = panelLayoutStore.getPresets().find((p) => p.id === preset.id);
    expect(found?.name).toBe("Original");
  });
});

// ─── subscribe / emit ─────────────────────────────────────────────────────────

describe("subscribe", () => {
  it("calls listener on setRect", () => {
    let count = 0;
    const unsub = panelLayoutStore.subscribe(() => count++);
    panelLayoutStore.setRect(uid(), { x: 1, y: 2, w: 3, h: 4 });
    unsub();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  it("unsubscribe stops calls", () => {
    let count = 0;
    const unsub = panelLayoutStore.subscribe(() => count++);
    unsub();
    const before = count;
    panelLayoutStore.setRect(uid(), { x: 1, y: 2, w: 3, h: 4 });
    expect(count).toBe(before);
  });
});
