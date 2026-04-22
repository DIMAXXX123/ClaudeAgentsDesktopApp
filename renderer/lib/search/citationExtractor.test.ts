/**
 * citationExtractor.test.ts — NOVA pillar
 * Run: npx vitest run lib/search/citationExtractor.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  splitSentences,
  extractCitations,
  topCitation,
} from "./citationExtractor";
import type { MemoryNode } from "@/lib/memoryGalaxy";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeNode = (
  partial: Partial<MemoryNode> & Pick<MemoryNode, "id" | "type">,
): MemoryNode => ({
  name: partial.id,
  description: "",
  tags: [],
  sizeBytes: 100,
  degree: 0,
  ...partial,
});

const SKILL_NODE = makeNode({
  id: "skill/tdd.md",
  type: "skill",
  name: "TDD Workflow",
  description:
    "Test-driven development means writing tests first. " +
    "Use vitest for TypeScript projects. " +
    "Red-green-refactor cycle keeps code clean and well-tested.",
  tags: ["testing", "vitest"],
});

const SHORT_NODE = makeNode({
  id: "rule/nextjs.md",
  type: "rule",
  name: "Next.js Rules",
  description: "Use server components by default.",
  tags: [],
});

const EMPTY_NODE = makeNode({
  id: "unknown/empty.md",
  type: "unknown",
  name: "Empty",
  description: "",
  tags: [],
});

// ── splitSentences ────────────────────────────────────────────────────────────

describe("splitSentences", () => {
  it("splits on period + space", () => {
    const result = splitSentences("Hello world. This is a test. Done.");
    expect(result.length).toBeGreaterThanOrEqual(2);
    expect(result[0]).toContain("Hello world");
  });

  it("splits on double newline", () => {
    const result = splitSentences("First paragraph.\n\nSecond paragraph here.");
    expect(result.some((s) => s.includes("First"))).toBe(true);
    expect(result.some((s) => s.includes("Second"))).toBe(true);
  });

  it("filters out trivially short chunks", () => {
    const result = splitSentences("Hi. Hello world. This is longer text here.");
    // "Hi." is too short, should be filtered
    expect(result.every((s) => s.length >= 12)).toBe(true);
  });

  it("returns empty array for empty string", () => {
    expect(splitSentences("")).toHaveLength(0);
  });

  it("trims whitespace from sentences", () => {
    const result = splitSentences("  First sentence.  Second sentence here.  ");
    result.forEach((s) => {
      expect(s).toBe(s.trim());
    });
  });
});

// ── extractCitations ──────────────────────────────────────────────────────────

describe("extractCitations", () => {
  it("returns a citation for a matched passage", () => {
    const citations = extractCitations(SKILL_NODE, ["vitest", "typescript"]);
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0].source).toBe(SKILL_NODE.id);
    expect(citations[0].label).toBe("skill");
  });

  it("includes matchedTokens that appear in excerpt", () => {
    const citations = extractCitations(SKILL_NODE, ["vitest"]);
    const cit = citations[0];
    expect(cit.matchedTokens).toContain("vitest");
    expect(cit.excerpt.toLowerCase()).toContain("vitest");
  });

  it("similarity is between 0 and 1", () => {
    const citations = extractCitations(SKILL_NODE, ["vitest", "python"]);
    citations.forEach((c) => {
      expect(c.similarity).toBeGreaterThanOrEqual(0);
      expect(c.similarity).toBeLessThanOrEqual(1);
    });
  });

  it("returns at most maxCitations results", () => {
    const citations = extractCitations(SKILL_NODE, ["test", "vitest"], 1);
    expect(citations.length).toBeLessThanOrEqual(1);
  });

  it("returns fallback citation for empty matchedTokens", () => {
    const citations = extractCitations(SKILL_NODE, []);
    // No tokens → returns minimal citation with description or empty
    expect(citations.length).toBeLessThanOrEqual(1);
    if (citations.length > 0) {
      expect(citations[0].similarity).toBe(0);
    }
  });

  it("handles node with no description", () => {
    const citations = extractCitations(EMPTY_NODE, ["something"]);
    expect(citations).toHaveLength(0);
  });

  it("handles single-sentence description (no split possible)", () => {
    const citations = extractCitations(SHORT_NODE, ["server"]);
    expect(citations.length).toBeGreaterThan(0);
    expect(citations[0].excerpt).toContain("server");
  });

  it("excerpt does not exceed 220 chars", () => {
    const longNode = makeNode({
      id: "skill/long.md",
      type: "skill",
      name: "Long",
      description:
        "This is a very long sentence about testing and vitest and typescript that goes on and on for a very long time indeed, covering many topics like test-driven development, red-green-refactor cycles, and more about vitest and testing frameworks.",
    });
    const citations = extractCitations(longNode, ["vitest", "testing"]);
    citations.forEach((c) => {
      expect(c.excerpt.length).toBeLessThanOrEqual(220);
    });
  });

  it("similarity is 1.0 when all tokens match in a single sentence", () => {
    const node = makeNode({
      id: "skill/perfect.md",
      type: "skill",
      name: "Perfect Match",
      description: "Use vitest for testing TypeScript projects effectively.",
    });
    const citations = extractCitations(node, ["vitest", "testing"]);
    expect(citations[0].similarity).toBe(1);
  });

  it("ranks best-matching sentence first", () => {
    // "vitest for TypeScript" sentence should rank higher than "tests first" sentence
    const citations = extractCitations(SKILL_NODE, ["vitest", "typescript"]);
    expect(citations[0].similarity).toBeGreaterThanOrEqual(
      citations[citations.length - 1]?.similarity ?? 0,
    );
  });
});

// ── topCitation ───────────────────────────────────────────────────────────────

describe("topCitation", () => {
  it("returns undefined for empty array", () => {
    expect(topCitation([])).toBeUndefined();
  });

  it("returns citation with highest similarity", () => {
    const cits = [
      { source: "a", label: "skill", excerpt: "a", matchedTokens: [], similarity: 0.3 },
      { source: "b", label: "rule", excerpt: "b", matchedTokens: [], similarity: 0.9 },
      { source: "c", label: "agent", excerpt: "c", matchedTokens: [], similarity: 0.5 },
    ];
    const top = topCitation(cits);
    expect(top?.source).toBe("b");
    expect(top?.similarity).toBe(0.9);
  });

  it("returns the single element when only one citation", () => {
    const single = [
      { source: "x", label: "plan", excerpt: "text", matchedTokens: ["plan"], similarity: 0.7 },
    ];
    expect(topCitation(single)).toEqual(single[0]);
  });
});
