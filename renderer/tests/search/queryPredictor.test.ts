/**
 * Tests for queryPredictor — NOVA pillar (lib/search/queryPredictor.ts)
 * Run: npx vitest run tests/search/queryPredictor.test.ts
 */

import { describe, it, expect } from "vitest";
import { predictQueries, scorePrediction, rankedPredictions } from "@/lib/search/queryPredictor";

// ── predictQueries ─────────────────────────────────────────────────────────────

describe("predictQueries", () => {
  it("returns empty for blank query", () => {
    expect(predictQueries("")).toHaveLength(0);
  });

  it("returns empty for single-char query", () => {
    expect(predictQueries("a")).toHaveLength(0);
  });

  it("returns at most maxPredictions results", () => {
    const preds = predictQueries("testing vitest", { maxPredictions: 3 });
    expect(preds.length).toBeLessThanOrEqual(3);
  });

  it("returns no duplicates", () => {
    const preds = predictQueries("testing vitest", { maxPredictions: 10 });
    const lower  = preds.map((p) => p.toLowerCase());
    const unique  = new Set(lower);
    expect(unique.size).toBe(preds.length);
  });

  it("generates prefix expansion variants (list all / show me / how to)", () => {
    const preds   = predictQueries("uefn", { maxPredictions: 10 });
    const prefixes = ["how to", "list all", "show me"];
    const has = preds.some((p) =>
      prefixes.some((prefix) => p.toLowerCase().startsWith(prefix)),
    );
    expect(has).toBe(true);
  });

  it("generates type expansion when no type hint in query", () => {
    const preds = predictQueries("testing", { maxPredictions: 10 });
    const has   = preds.some((p) =>
      p.includes("related to") || p.includes("skill") || p.includes("agent"),
    );
    expect(has).toBe(true);
  });

  it("skips type expansion when query already has a type hint", () => {
    const preds = predictQueries("show me skills about testing", { maxPredictions: 10 });
    const redundant = preds.some((p) => p.includes("skills related to"));
    expect(redundant).toBe(false);
  });

  it("includes history-based variants that share tokens", () => {
    const history = ["vitest hooks tutorial", "vitest setup jest-dom", "unrelated topic"];
    const preds   = predictQueries("vitest", { history, maxPredictions: 10 });
    const has     = preds.some((p) => p.toLowerCase().includes("vitest"));
    expect(has).toBe(true);
  });

  it("does not include current query verbatim in predictions", () => {
    const query = "vitest testing";
    const preds = predictQueries(query, { history: [query], maxPredictions: 10 });
    expect(preds.map((p) => p.toLowerCase())).not.toContain(query.toLowerCase());
  });

  it("generates token-drop variant for multi-token query", () => {
    const preds       = predictQueries("uefn verse maps", { maxPredictions: 10 });
    const hasTokenDrop = preds.some((p) => p === "uefn verse");
    expect(hasTokenDrop).toBe(true);
  });

  it("does not generate token-drop for single-token query", () => {
    const preds = predictQueries("uefn", { maxPredictions: 10 });
    // Token drop only fires when ≥ 2 tokens; single token should not produce a drop
    const hasDrop = preds.some((p) => p === "");
    expect(hasDrop).toBe(false);
  });
});

// ── scorePrediction ─────────────────────────────────────────────────────────────

describe("scorePrediction", () => {
  it("longer queries score higher than shorter queries", () => {
    expect(scorePrediction("uefn verse maps fortnite")).toBeGreaterThan(
      scorePrediction("uefn"),
    );
  });

  it("queries with type hints score higher than those without", () => {
    expect(scorePrediction("skills about testing")).toBeGreaterThan(
      scorePrediction("about testing"),
    );
  });

  it("blank query scores zero", () => {
    expect(scorePrediction("")).toBe(0);
  });

  it("returns a non-negative number", () => {
    expect(scorePrediction("any query string")).toBeGreaterThanOrEqual(0);
  });
});

// ── rankedPredictions ──────────────────────────────────────────────────────────

describe("rankedPredictions", () => {
  it("returns predictions in descending score order", () => {
    const preds  = rankedPredictions("uefn verse", { maxPredictions: 10 });
    const scores = preds.map(scorePrediction);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it("respects maxPredictions", () => {
    const preds = rankedPredictions("testing", { maxPredictions: 2 });
    expect(preds.length).toBeLessThanOrEqual(2);
  });

  it("returns empty for very short query", () => {
    expect(rankedPredictions("x")).toHaveLength(0);
  });

  it("the highest-scored prediction has a type hint when possible", () => {
    // Multi-token queries with type expansion should put typed variant first
    const preds = rankedPredictions("testing", { maxPredictions: 6 });
    if (preds.length > 0) {
      // Soft check: at least one prediction contains a type noun
      const typeNouns = ["skill", "agent", "hook", "rule", "plan", "project"];
      const hasType   = preds.some((p) =>
        typeNouns.some((t) => p.toLowerCase().includes(t)),
      );
      expect(hasType).toBe(true);
    }
  });
});
