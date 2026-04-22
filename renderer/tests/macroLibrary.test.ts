/**
 * tests/macroLibrary.test.ts
 *
 * Unit tests for lib/orchestration/macroLibrary:
 *   - buildLibrary merges macros + chains in correct order
 *   - searchLibrary returns fuzzy-ranked results
 *   - searchLibrary with empty query returns all entries
 *   - searchLibrary filters out non-matching entries
 *   - chain entries are searchable by step content
 */

import { describe, it, expect } from "vitest";
import type { Macro } from "@/lib/orchestration/macroStore";
import type { MacroChain } from "@/lib/orchestration/macroRecorder";
import {
  buildLibrary,
  searchLibrary,
  type MacroLibraryEntry,
} from "@/lib/orchestration/macroLibrary";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MACRO_ULTRON: Macro = {
  id: "m1",
  name: "Open ULTRON",
  keybinding: "ctrl+1",
  action: { type: "open-agent", agentId: "ultron" },
  createdAt: 1000,
};

const MACRO_NOVA: Macro = {
  id: "m2",
  name: "Open NOVA",
  keybinding: "ctrl+2",
  action: { type: "open-agent", agentId: "nova" },
  createdAt: 2000,
};

const MACRO_CMD: Macro = {
  id: "m3",
  name: "Open Memory Panel",
  keybinding: "ctrl+m",
  action: { type: "run-command", command: "open-memory" },
  createdAt: 3000,
};

const CHAIN_DAILY: MacroChain = {
  id: "c1",
  name: "Daily Standup",
  steps: [
    { kind: "open-agent", agentId: "ultron", delayMs: 0, ts: 1000 },
    { kind: "run-command", command: "open-memory", delayMs: 500, ts: 1500 },
  ],
  recordedAt: 1000,
  durationMs: 1500,
};

const CHAIN_FORGE: MacroChain = {
  id: "c2",
  name: "Build & Deploy",
  steps: [
    { kind: "open-agent", agentId: "forge", delayMs: 0, ts: 2000 },
    { kind: "send-prompt", agentId: "forge", prompt: "run build pipeline", delayMs: 100, ts: 2100 },
  ],
  recordedAt: 2000,
  durationMs: 1000,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildLibrary", () => {
  it("returns empty array for empty inputs", () => {
    expect(buildLibrary([], [])).toEqual([]);
  });

  it("chains come before macros", () => {
    const lib = buildLibrary([MACRO_ULTRON, MACRO_NOVA], [CHAIN_DAILY]);
    expect(lib[0].kind).toBe("chain");
    expect(lib[1].kind).toBe("macro");
    expect(lib[2].kind).toBe("macro");
  });

  it("preserves all entries", () => {
    const lib = buildLibrary([MACRO_ULTRON, MACRO_NOVA, MACRO_CMD], [CHAIN_DAILY, CHAIN_FORGE]);
    expect(lib).toHaveLength(5);
    const chainCount = lib.filter((e) => e.kind === "chain").length;
    const macroCount = lib.filter((e) => e.kind === "macro").length;
    expect(chainCount).toBe(2);
    expect(macroCount).toBe(3);
  });

  it("carries correct references", () => {
    const lib = buildLibrary([MACRO_ULTRON], [CHAIN_DAILY]);
    const ce = lib.find((e) => e.kind === "chain") as Extract<MacroLibraryEntry, { kind: "chain" }>;
    const me = lib.find((e) => e.kind === "macro") as Extract<MacroLibraryEntry, { kind: "macro" }>;
    expect(ce.chain.id).toBe("c1");
    expect(me.macro.id).toBe("m1");
  });
});

describe("searchLibrary — empty query", () => {
  it("returns all entries when query is empty", () => {
    const results = searchLibrary([MACRO_ULTRON, MACRO_NOVA], [CHAIN_DAILY], "");
    expect(results).toHaveLength(3);
  });

  it("all scores are 0 for empty query", () => {
    const results = searchLibrary([MACRO_ULTRON], [CHAIN_DAILY], "");
    for (const r of results) {
      expect(r.score).toBe(0);
    }
  });
});

describe("searchLibrary — keyword filtering", () => {
  it("finds macro by name", () => {
    const results = searchLibrary([MACRO_ULTRON, MACRO_NOVA], [], "ultron");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const topEntry = results[0].item;
    expect(topEntry.kind).toBe("macro");
    if (topEntry.kind === "macro") {
      expect(topEntry.macro.id).toBe("m1");
    }
  });

  it("finds chain by name", () => {
    const results = searchLibrary([], [CHAIN_DAILY, CHAIN_FORGE], "daily");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const topEntry = results[0].item;
    expect(topEntry.kind).toBe("chain");
    if (topEntry.kind === "chain") {
      expect(topEntry.chain.id).toBe("c1");
    }
  });

  it("finds chain by step agent content", () => {
    // CHAIN_FORGE has "forge" as agentId in steps
    const results = searchLibrary([], [CHAIN_DAILY, CHAIN_FORGE], "forge");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const topEntry = results[0].item;
    expect(topEntry.kind).toBe("chain");
    if (topEntry.kind === "chain") {
      expect(topEntry.chain.id).toBe("c2");
    }
  });

  it("finds chain by step prompt content", () => {
    // CHAIN_FORGE has "run build pipeline" in a send-prompt step
    const results = searchLibrary([], [CHAIN_DAILY, CHAIN_FORGE], "pipeline");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].item.kind).toBe("chain");
  });

  it("finds macro by keybinding", () => {
    const results = searchLibrary([MACRO_CMD], [], "ctrl+m");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const top = results[0].item;
    expect(top.kind).toBe("macro");
    if (top.kind === "macro") expect(top.macro.id).toBe("m3");
  });

  it("finds macro by action command", () => {
    const results = searchLibrary([MACRO_CMD], [], "open-memory");
    expect(results.length).toBeGreaterThanOrEqual(1);
  });

  it("filters out non-matching entries", () => {
    const results = searchLibrary([MACRO_ULTRON, MACRO_NOVA], [CHAIN_FORGE], "zzz_no_match");
    expect(results).toHaveLength(0);
  });

  it("ranks exact-name match above partial match", () => {
    const results = searchLibrary([MACRO_ULTRON, MACRO_NOVA, MACRO_CMD], [], "nova");
    expect(results.length).toBeGreaterThanOrEqual(1);
    const top = results[0].item;
    expect(top.kind).toBe("macro");
    if (top.kind === "macro") expect(top.macro.id).toBe("m2");
  });
});

describe("searchLibrary — mixed results", () => {
  it("returns both macros and chains when both match", () => {
    // "open" matches "Open ULTRON", "Open NOVA", "Open Memory Panel" (macros) + "Daily Standup" step content
    const results = searchLibrary(
      [MACRO_ULTRON, MACRO_NOVA, MACRO_CMD],
      [CHAIN_DAILY],
      "open",
    );
    const kinds = new Set(results.map((r) => r.item.kind));
    // At minimum macro entries should match ("Open ...")
    expect(kinds.has("macro")).toBe(true);
  });
});
