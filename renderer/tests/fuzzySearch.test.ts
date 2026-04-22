/**
 * Tests for lib/orchestration/fuzzySearch.ts
 * CommandPaletteV2 fuzzy engine — score, filter, highlight.
 */

import { describe, it, expect } from "vitest";
import {
  fuzzyScore,
  fuzzyFilter,
  buildHighlightSegments,
} from "@/lib/orchestration/fuzzySearch";

// ── fuzzyScore ────────────────────────────────────────────────────────────────

describe("fuzzyScore", () => {
  it("returns score 100 for empty query", () => {
    const r = fuzzyScore("anything", "");
    expect(r).not.toBeNull();
    expect(r!.score).toBe(100);
    expect(r!.ranges).toEqual([]);
  });

  it("returns null when chars are not all found", () => {
    expect(fuzzyScore("nova", "xyz")).toBeNull();
    expect(fuzzyScore("forge", "fz")).toBeNull();
  });

  it("matches contiguous chars and boosts score", () => {
    const contiguous = fuzzyScore("ultron", "ultr");
    const sparse = fuzzyScore("ultrasonicron", "ultr");
    expect(contiguous).not.toBeNull();
    expect(sparse).not.toBeNull();
    // contiguous prefix match should score higher or equal vs scattered
    expect(contiguous!.score).toBeGreaterThanOrEqual(sparse!.score);
  });

  it("exact match scores highest", () => {
    const exact = fuzzyScore("nova", "nova");
    const partial = fuzzyScore("nova research", "nova");
    expect(exact).not.toBeNull();
    expect(partial).not.toBeNull();
    expect(exact!.score).toBeGreaterThan(partial!.score);
  });

  it("prefix match adds bonus over mid-string match", () => {
    const prefix = fuzzyScore("nova", "no");
    const midStr = fuzzyScore("information", "no"); // 'n' at 2, 'o' at 6 — not start
    expect(prefix).not.toBeNull();
    expect(midStr).not.toBeNull();
    expect(prefix!.score).toBeGreaterThan(midStr!.score);
  });

  it("is case-insensitive", () => {
    const lower = fuzzyScore("Forge", "fo");
    const upper = fuzzyScore("Forge", "FO");
    expect(lower).not.toBeNull();
    expect(upper).not.toBeNull();
    expect(lower!.score).toBe(upper!.score);
  });

  it("populates ranges with matched char indices", () => {
    const r = fuzzyScore("ultron", "utr");
    expect(r).not.toBeNull();
    const { ranges } = r!;
    // 'u'→0, 't'→2(?), 'r'→3 — verify they're all valid indices
    expect(ranges).toHaveLength(3);
    ranges.forEach((idx) => expect(idx).toBeGreaterThanOrEqual(0));
  });

  it("score is capped at 100", () => {
    const r = fuzzyScore("a", "a");
    expect(r!.score).toBeLessThanOrEqual(100);
  });
});

// ── fuzzyFilter ───────────────────────────────────────────────────────────────

describe("fuzzyFilter", () => {
  const agents = [
    { id: "ultron", name: "ULTRON", room: "COMMAND BRIDGE" },
    { id: "nova", name: "NOVA", room: "CODEX ARCHIVE" },
    { id: "forge", name: "FORGE", room: "CODE FOUNDRY" },
    { id: "ares", name: "ARES", room: "WAR DECK" },
    { id: "echo", name: "ECHO", room: "SIGNAL RELAY" },
    { id: "midas", name: "MIDAS", room: "DATA VAULT" },
  ];

  it("returns all items with score 0 for empty query", () => {
    const r = fuzzyFilter(agents, "", (a) => [a.name, a.room]);
    expect(r).toHaveLength(agents.length);
    r.forEach((x) => expect(x.score).toBe(0));
  });

  it("filters to matching items only", () => {
    const r = fuzzyFilter(agents, "no", (a) => [a.name, a.room]);
    // NOVA matches 'no' as prefix; others shouldn't contain n+o in order
    const ids = r.map((x) => x.item.id);
    expect(ids).toContain("nova");
    expect(ids).not.toContain("midas");
  });

  it("sorts by descending score", () => {
    const r = fuzzyFilter(agents, "code", (a) => [a.name, a.room]);
    // "CODE FOUNDRY" and "CODEX ARCHIVE" both match; scores descending
    for (let i = 1; i < r.length; i++) {
      expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
    }
  });

  it("picks best score across multiple keys", () => {
    // ULTRON matches 'ul' in name; SIGNAL RELAY matches nothing useful
    const r = fuzzyFilter(agents, "ul", (a) => [a.name, a.room]);
    const ids = r.map((x) => x.item.id);
    expect(ids).toContain("ultron");
  });

  it("returns empty array when nothing matches", () => {
    const r = fuzzyFilter(agents, "zzz", (a) => [a.name, a.room]);
    expect(r).toHaveLength(0);
  });
});

// ── buildHighlightSegments ────────────────────────────────────────────────────

describe("buildHighlightSegments", () => {
  it("returns a single non-highlighted segment for empty ranges", () => {
    const segs = buildHighlightSegments("hello", []);
    expect(segs).toEqual([{ text: "hello", highlight: false }]);
  });

  it("highlights the entire string when all indices match", () => {
    const segs = buildHighlightSegments("ab", [0, 1]);
    // should be one highlighted segment
    expect(segs.every((s) => s.highlight)).toBe(true);
    expect(segs.map((s) => s.text).join("")).toBe("ab");
  });

  it("alternates highlight/non-highlight correctly", () => {
    // 'u' at 0, 'r' at 3 in "ultron" → segments: [u][ltr][o][n] ish
    const segs = buildHighlightSegments("ultron", [0, 3]);
    const reconstructed = segs.map((s) => s.text).join("");
    expect(reconstructed).toBe("ultron");
    // first segment (index 0) should be highlighted
    expect(segs[0].highlight).toBe(true);
  });

  it("handles single char highlight at start", () => {
    const segs = buildHighlightSegments("nova", [0]);
    expect(segs[0]).toEqual({ text: "n", highlight: true });
    expect(segs[1]).toEqual({ text: "ova", highlight: false });
  });

  it("handles single char highlight at end", () => {
    const segs = buildHighlightSegments("nova", [3]);
    expect(segs[segs.length - 1]).toEqual({ text: "a", highlight: true });
  });

  it("reconstructed text always equals original", () => {
    const texts = ["ULTRON", "NOVA", "Code Foundry", "signal relay"];
    for (const text of texts) {
      const segs = buildHighlightSegments(text, [0, 2, 4]);
      expect(segs.map((s) => s.text).join("")).toBe(text);
    }
  });
});
