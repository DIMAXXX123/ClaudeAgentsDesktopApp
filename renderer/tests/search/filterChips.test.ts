/**
 * filterChips.test.ts — NOVA pillar unit tests
 *
 * Tests for lib/search/filterChips.ts pure utility functions.
 * Run: npx vitest run tests/search/filterChips.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  countByType,
  filterByTypes,
  toggleType,
  activeChipTypes,
  resultPassesFilter,
  FILTER_CHIP_TYPES,
  FILTER_CHIP_LABELS,
} from "@/lib/search/filterChips";
import type { SearchResult } from "@/lib/search/nlSearch";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeResult(partial: Partial<SearchResult> & { id: string }): SearchResult {
  return {
    kind: "memory",
    name: partial.id,
    type: "reference",
    description: "",
    tags: [],
    score: 1.0,
    matchedTokens: [],
    ...partial,
  };
}

const SKILL_1   = makeResult({ id: "s1", name: "TDD Workflow",    type: "skill",   score: 3 });
const SKILL_2   = makeResult({ id: "s2", name: "Code Review",     type: "skill",   score: 2 });
const AGENT_1   = makeResult({ id: "a1", name: "uefn-verse",      type: "agent",   score: 5 });
const HOOK_1    = makeResult({ id: "h1", name: "post-edit hook",  type: "hook",    score: 1 });
const CHAT_1    = makeResult({ id: "c1", name: "session note",    type: "chat",    kind: "chat", score: 1.5 });
const PLAN_1    = makeResult({ id: "p1", name: "overnight plan",  type: "plan",    score: 2 });

const MIX = [SKILL_1, SKILL_2, AGENT_1, HOOK_1, CHAT_1, PLAN_1];

// ── countByType ───────────────────────────────────────────────────────────────

describe("countByType", () => {
  it("returns empty map for empty results", () => {
    expect(countByType([])).toEqual(new Map());
  });

  it("counts single type correctly", () => {
    const counts = countByType([SKILL_1, SKILL_2]);
    expect(counts.get("skill")).toBe(2);
    expect(counts.size).toBe(1);
  });

  it("counts multiple types correctly", () => {
    const counts = countByType(MIX);
    expect(counts.get("skill")).toBe(2);
    expect(counts.get("agent")).toBe(1);
    expect(counts.get("hook")).toBe(1);
    expect(counts.get("chat")).toBe(1);
    expect(counts.get("plan")).toBe(1);
    expect(counts.size).toBe(5);
  });

  it("does not include zero-count types", () => {
    const counts = countByType([SKILL_1]);
    expect(counts.has("agent")).toBe(false);
  });
});

// ── filterByTypes ─────────────────────────────────────────────────────────────

describe("filterByTypes", () => {
  it("returns all results when activeTypes is empty (no filter)", () => {
    const filtered = filterByTypes(MIX, new Set());
    expect(filtered).toHaveLength(MIX.length);
  });

  it("filters to only the selected type", () => {
    const filtered = filterByTypes(MIX, new Set(["skill"]));
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.type === "skill")).toBe(true);
  });

  it("supports multi-type filter", () => {
    const filtered = filterByTypes(MIX, new Set(["skill", "agent"]));
    expect(filtered).toHaveLength(3);
    const types = new Set(filtered.map((r) => r.type));
    expect(types.has("skill")).toBe(true);
    expect(types.has("agent")).toBe(true);
    expect(types.has("hook")).toBe(false);
  });

  it("returns empty array when no results match active type", () => {
    const filtered = filterByTypes(MIX, new Set(["command"]));
    expect(filtered).toHaveLength(0);
  });

  it("preserves original order", () => {
    const filtered = filterByTypes([SKILL_2, AGENT_1, SKILL_1], new Set(["skill"]));
    expect(filtered[0].id).toBe("s2");
    expect(filtered[1].id).toBe("s1");
  });

  it("does not mutate the input results array", () => {
    const original = [...MIX];
    filterByTypes(MIX, new Set(["skill"]));
    expect(MIX).toEqual(original);
  });
});

// ── toggleType ────────────────────────────────────────────────────────────────

describe("toggleType", () => {
  it("adds a type when not active", () => {
    const next = toggleType(new Set(), "skill");
    expect(next.has("skill")).toBe(true);
    expect(next.size).toBe(1);
  });

  it("removes a type when already active", () => {
    const next = toggleType(new Set(["skill"]), "skill");
    expect(next.has("skill")).toBe(false);
    expect(next.size).toBe(0);
  });

  it("does not mutate the original set", () => {
    const original = new Set(["skill"]);
    toggleType(original, "skill");
    expect(original.has("skill")).toBe(true);
  });

  it("preserves other active types when toggling one off", () => {
    const next = toggleType(new Set(["skill", "agent"]), "skill");
    expect(next.has("agent")).toBe(true);
    expect(next.has("skill")).toBe(false);
  });

  it("supports toggling on top of existing multi-selection", () => {
    const next = toggleType(new Set(["skill", "agent"]), "hook");
    expect(next.has("skill")).toBe(true);
    expect(next.has("agent")).toBe(true);
    expect(next.has("hook")).toBe(true);
    expect(next.size).toBe(3);
  });
});

// ── activeChipTypes ───────────────────────────────────────────────────────────

describe("activeChipTypes", () => {
  it("returns empty array for empty results", () => {
    expect(activeChipTypes([])).toHaveLength(0);
  });

  it("returns only types present in results", () => {
    const chips = activeChipTypes([SKILL_1, AGENT_1]);
    expect(chips).toContain("skill");
    expect(chips).toContain("agent");
    expect(chips).not.toContain("hook");
  });

  it("respects FILTER_CHIP_TYPES display order", () => {
    const chips = activeChipTypes(MIX);
    // skill comes before agent in FILTER_CHIP_TYPES
    const skillIdx = chips.indexOf("skill");
    const agentIdx = chips.indexOf("agent");
    expect(skillIdx).toBeLessThan(agentIdx);
    // agent before hook
    const hookIdx = chips.indexOf("hook");
    expect(agentIdx).toBeLessThan(hookIdx);
  });

  it("includes chat type when present", () => {
    const chips = activeChipTypes([SKILL_1, CHAT_1]);
    expect(chips).toContain("chat");
  });
});

// ── resultPassesFilter ────────────────────────────────────────────────────────

describe("resultPassesFilter", () => {
  it("passes all results when filter is empty", () => {
    expect(resultPassesFilter(SKILL_1, new Set())).toBe(true);
    expect(resultPassesFilter(AGENT_1, new Set())).toBe(true);
  });

  it("passes result that matches active type", () => {
    expect(resultPassesFilter(SKILL_1, new Set(["skill"]))).toBe(true);
  });

  it("blocks result that doesn't match active type", () => {
    expect(resultPassesFilter(AGENT_1, new Set(["skill"]))).toBe(false);
  });

  it("passes result when its type is one of multiple active types", () => {
    expect(resultPassesFilter(HOOK_1, new Set(["skill", "hook"]))).toBe(true);
  });
});

// ── Constants sanity ──────────────────────────────────────────────────────────

describe("constants", () => {
  it("FILTER_CHIP_TYPES has no duplicates", () => {
    const unique = new Set(FILTER_CHIP_TYPES);
    expect(unique.size).toBe(FILTER_CHIP_TYPES.length);
  });

  it("every FILTER_CHIP_TYPE has a label", () => {
    for (const type of FILTER_CHIP_TYPES) {
      expect(FILTER_CHIP_LABELS[type]).toBeTruthy();
    }
  });

  it("FILTER_CHIP_LABELS contains at least 10 types", () => {
    expect(Object.keys(FILTER_CHIP_LABELS).length).toBeGreaterThanOrEqual(10);
  });
});
