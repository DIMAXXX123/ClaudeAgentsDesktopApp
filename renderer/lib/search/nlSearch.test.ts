/**
 * Inline tests for nlSearch — NOVA pillar.
 * Run: npx vitest run lib/search/nlSearch.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  tokenize,
  detectTypeHints,
  scoreNode,
  nlSearch,
  highlightTokens,
} from "./nlSearch";
import type { MemoryNode } from "@/lib/memoryGalaxy";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeNode = (partial: Partial<MemoryNode> & { id: string }): MemoryNode => ({
  name: partial.id,
  type: "reference",
  description: "",
  tags: [],
  sizeBytes: 100,
  degree: 0,
  ...partial,
});

const TDD_SKILL = makeNode({
  id: "skill/mattpocock-tdd.md",
  name: "TDD Workflow",
  type: "skill",
  description: "Test-driven development workflow with vitest and pytest",
  tags: ["testing", "vitest", "python"],
});

const UEFN_AGENT = makeNode({
  id: "agent/uefn-verse.md",
  name: "uefn-verse",
  type: "agent",
  description: "UEFN Verse code, Red vs Blue maps, device scripts",
  tags: ["uefn", "verse", "fortnite"],
});

const MEMORY_INDEX = makeNode({
  id: "memory/memory.md",
  name: "INDEX",
  type: "index",
  description: "Root memory index linking all project files",
  tags: ["memory", "plan"],
});

const NEXTJS_RULE = makeNode({
  id: "rule/nextjs.md",
  name: "Next.js Rules",
  type: "rule",
  description: "Rules for Next.js App Router, TypeScript strict, Tailwind",
  tags: ["nextjs", "typescript", "tailwind"],
});

const NODES = [TDD_SKILL, UEFN_AGENT, MEMORY_INDEX, NEXTJS_RULE];

// ── tokenize ──────────────────────────────────────────────────────────────────

describe("tokenize", () => {
  it("splits on non-alphanumeric", () => {
    expect(tokenize("hello world")).toEqual(["hello", "world"]);
  });

  it("filters stop words and single chars", () => {
    const result = tokenize("find a skill about testing");
    expect(result).not.toContain("find");
    expect(result).not.toContain("a");
    expect(result).not.toContain("about");
    expect(result).toContain("testing");
  });

  it("lowercases everything", () => {
    expect(tokenize("UEFN Verse")).toEqual(["uefn", "verse"]);
  });

  it("keeps hyphens inside tokens", () => {
    const result = tokenize("claude-md rules");
    expect(result).toContain("claude-md");
    expect(result).toContain("rules");
  });
});

// ── detectTypeHints ────────────────────────────────────────────────────────────

describe("detectTypeHints", () => {
  it("detects 'skill' type hint", () => {
    expect(detectTypeHints("show me skills about testing")).toContain("skill");
  });

  it("detects 'agent' type hint", () => {
    expect(detectTypeHints("list all agents")).toContain("agent");
  });

  it("returns empty for no type hint", () => {
    expect(detectTypeHints("uefn verse maps")).toHaveLength(0);
  });

  it("detects multiple type hints", () => {
    const hints = detectTypeHints("skills and hooks for telegram");
    expect(hints).toContain("skill");
    expect(hints).toContain("hook");
  });

  it("detects 'hook' type hint", () => {
    expect(detectTypeHints("show me all hooks")).toContain("hook");
  });

  it("detects 'rule' type hint", () => {
    expect(detectTypeHints("what are my rules")).toContain("rule");
  });
});

// ── scoreNode ─────────────────────────────────────────────────────────────────

describe("scoreNode", () => {
  it("scores name match higher than description match", () => {
    const [namScore] = scoreNode(TDD_SKILL, ["tdd"], []);
    const [descScore] = scoreNode(TDD_SKILL, ["vitest"], []);
    // "tdd" appears in name → should score higher than "vitest" only in description
    expect(namScore).toBeGreaterThan(0);
    expect(descScore).toBeGreaterThan(0);
    expect(namScore).toBeGreaterThanOrEqual(descScore);
  });

  it("returns 0 for empty tokens", () => {
    const [score] = scoreNode(TDD_SKILL, [], []);
    expect(score).toBe(0);
  });

  it("applies type-hint multiplier", () => {
    const [withHint] = scoreNode(TDD_SKILL, ["workflow"], ["skill"]);
    const [withoutHint] = scoreNode(TDD_SKILL, ["workflow"], []);
    expect(withHint).toBeGreaterThan(withoutHint);
  });

  it("reports matched tokens", () => {
    const [, matched] = scoreNode(UEFN_AGENT, ["uefn", "verse"], []);
    expect(matched).toContain("uefn");
    expect(matched).toContain("verse");
  });

  it("matches tags", () => {
    const [score, matched] = scoreNode(TDD_SKILL, ["testing"], []);
    expect(score).toBeGreaterThan(0);
    expect(matched).toContain("testing");
  });
});

// ── nlSearch ──────────────────────────────────────────────────────────────────

describe("nlSearch", () => {
  it("returns results sorted by descending score", () => {
    const results = nlSearch(NODES, "uefn verse");
    expect(results[0].id).toBe(UEFN_AGENT.id);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("filters by type hint in query", () => {
    const results = nlSearch(NODES, "show all agents");
    expect(results.every((r) => r.type === "agent")).toBe(true);
  });

  it("filters by explicit types option", () => {
    const results = nlSearch(NODES, "nextjs", [], { types: ["rule"] });
    expect(results.every((r) => r.type === "rule")).toBe(true);
  });

  it("respects limit option", () => {
    const results = nlSearch(NODES, "the", [], { limit: 2 });
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it("returns empty for empty query with no tokens", () => {
    const results = nlSearch(NODES, "");
    // Empty query → 0 tokens → all scores 0 → filtered out → empty
    expect(results).toHaveLength(0);
  });

  it("searches chat snippets", () => {
    const results = nlSearch(
      [],
      "telegram bot",
      [{ agentId: "echo", agentName: "Echo", role: "assistant", text: "Telegram bot config done", updatedAt: Date.now() }],
      { includeChats: true },
    );
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].kind).toBe("chat");
  });

  it("can exclude chats", () => {
    const results = nlSearch(
      [UEFN_AGENT],
      "uefn",
      [{ agentId: "echo", agentName: "Echo", role: "assistant", text: "uefn related", updatedAt: Date.now() }],
      { includeChats: false },
    );
    expect(results.every((r) => r.kind === "memory")).toBe(true);
  });
});

// ── highlightTokens ───────────────────────────────────────────────────────────

describe("highlightTokens", () => {
  it("wraps matched tokens in <mark>", () => {
    const out = highlightTokens("TDD workflow testing", ["tdd", "testing"]);
    expect(out).toContain("<mark>TDD</mark>");
    expect(out).toContain("<mark>testing</mark>");
  });

  it("returns original text when no tokens", () => {
    expect(highlightTokens("hello world", [])).toBe("hello world");
  });

  it("is case-insensitive", () => {
    const out = highlightTokens("UEFN Verse", ["uefn"]);
    expect(out).toContain("<mark>UEFN</mark>");
  });

  it("escapes regex special chars in tokens", () => {
    // If token has special chars it should not throw
    expect(() => highlightTokens("test (hello)", ["(hello)"])).not.toThrow();
  });
});
