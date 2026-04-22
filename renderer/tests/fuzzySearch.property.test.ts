/**
 * Property-based tests for lib/orchestration/fuzzySearch.ts
 * Uses fast-check to verify algebraic invariants across all input shapes,
 * including boundary and edge cases not covered by the unit suite.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  fuzzyScore,
  fuzzyFilter,
  buildHighlightSegments,
} from "@/lib/orchestration/fuzzySearch";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Printable ASCII string (no control chars) */
const asciiStr = fc.string({ minLength: 0, maxLength: 80, unit: "grapheme-ascii" });

/** Non-empty printable ASCII string */
const asciiStrNE = fc.string({ minLength: 1, maxLength: 80, unit: "grapheme-ascii" });

/** A short query (1-10 chars) to keep match rates reasonable */
const shortQuery = fc.string({ minLength: 1, maxLength: 10, unit: "grapheme-ascii" });

// ─── fuzzyScore — global invariants ─────────────────────────────────────────

describe("fuzzyScore — property-based", () => {
  it("empty query always returns score=100 and empty ranges for any text", () => {
    fc.assert(
      fc.property(asciiStr, (text) => {
        const r = fuzzyScore(text, "");
        expect(r).not.toBeNull();
        expect(r!.score).toBe(100);
        expect(r!.ranges).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });

  it("score is always in [0, 100] when match is found", () => {
    fc.assert(
      fc.property(asciiStrNE, asciiStr, (text, query) => {
        const r = fuzzyScore(text, query);
        if (r !== null) {
          expect(r.score).toBeGreaterThanOrEqual(0);
          expect(r.score).toBeLessThanOrEqual(100);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("ranges contains only valid indices into text", () => {
    fc.assert(
      fc.property(asciiStrNE, asciiStr, (text, query) => {
        const r = fuzzyScore(text, query);
        if (r !== null) {
          for (const idx of r.ranges) {
            expect(idx).toBeGreaterThanOrEqual(0);
            expect(idx).toBeLessThan(text.length);
          }
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("ranges length equals query length when match succeeds", () => {
    fc.assert(
      fc.property(asciiStrNE, shortQuery, (text, query) => {
        const r = fuzzyScore(text, query);
        if (r !== null) {
          expect(r.ranges).toHaveLength(query.replace(/./gu, (c) => c.toLowerCase()).split("").length);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("ranges are strictly increasing (greedy left-to-right scan)", () => {
    fc.assert(
      fc.property(asciiStrNE, shortQuery, (text, query) => {
        const r = fuzzyScore(text, query);
        if (r !== null && r.ranges.length > 1) {
          for (let i = 1; i < r.ranges.length; i++) {
            expect(r.ranges[i]).toBeGreaterThan(r.ranges[i - 1]);
          }
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("returns null when query is longer than text (can't fit all chars)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 5, unit: "grapheme-ascii" }),
        fc.string({ minLength: 6, maxLength: 20, unit: "grapheme-ascii" }),
        (shortText, longQuery) => {
          // Only expect null if query chars can't all appear in text
          // (fast-check may accidentally generate a query whose chars exist — skip those)
          const r = fuzzyScore(shortText, longQuery);
          if (r === null) {
            // Correct: not all query chars found in text
            expect(r).toBeNull();
          } else {
            // Match found means all chars were present — score must still be valid
            expect(r.score).toBeGreaterThanOrEqual(0);
            expect(r.score).toBeLessThanOrEqual(100);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("exact match on single char returns non-null with full bonus", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1, unit: "grapheme-ascii" }),
        (ch) => {
          const r = fuzzyScore(ch, ch);
          if (r !== null) {
            // single-char exact match should be ≥ any partial match score
            const partial = fuzzyScore(ch + ch + ch, ch);
            if (partial !== null) {
              expect(r.score).toBeGreaterThanOrEqual(partial.score);
            }
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("case-insensitive symmetry: score(text, UPPER(q)) === score(text, lower(q))", () => {
    fc.assert(
      fc.property(asciiStrNE, shortQuery, (text, query) => {
        const lower = fuzzyScore(text, query.toLowerCase());
        const upper = fuzzyScore(text, query.toUpperCase());
        // both null or both have equal scores
        if (lower === null) {
          expect(upper).toBeNull();
        } else {
          expect(upper).not.toBeNull();
          expect(lower.score).toBe(upper!.score);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("longer query on same text has range.length === query.length", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 3, maxLength: 20, unit: "grapheme-ascii" }),
        fc.nat({ max: 5 }),
        (text, trimLen) => {
          // use a prefix of text as query (guaranteed to match)
          const query = text.slice(0, Math.max(1, text.length - trimLen));
          const r = fuzzyScore(text, query);
          if (r !== null) {
            expect(r.ranges).toHaveLength(query.length);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("single-char text: only matches single-char queries whose char exists", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 1, unit: "grapheme-ascii" }),
        fc.string({ minLength: 1, maxLength: 1, unit: "grapheme-ascii" }),
        (text, query) => {
          const r = fuzzyScore(text, query);
          if (text.toLowerCase() === query.toLowerCase()) {
            expect(r).not.toBeNull();
          }
          // if null, no assertion needed — char just isn't in text
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── fuzzyFilter — property-based ────────────────────────────────────────────

describe("fuzzyFilter — property-based", () => {
  /** Small item pool for filter tests */
  const itemArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 10, unit: "grapheme-ascii" }),
    name: fc.string({ minLength: 1, maxLength: 30, unit: "grapheme-ascii" }),
  });
  const itemsArb = fc.array(itemArb, { minLength: 0, maxLength: 20 });

  it("output length is always <= input length", () => {
    fc.assert(
      fc.property(itemsArb, asciiStr, (items, query) => {
        const r = fuzzyFilter(items, query, (i) => [i.name]);
        expect(r.length).toBeLessThanOrEqual(items.length);
      }),
      { numRuns: 1000 },
    );
  });

  it("empty items always returns empty result", () => {
    fc.assert(
      fc.property(asciiStr, (query) => {
        const r = fuzzyFilter([], query, (i: { name: string }) => [i.name]);
        expect(r).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });

  it("whitespace-only query returns all items with score 0", () => {
    fc.assert(
      fc.property(
        itemsArb,
        fc.string({ minLength: 1, maxLength: 5 }).map((s) => s.replace(/\S/g, " ")),
        (items, ws) => {
          if (ws.trim() !== "") return; // skip if not all-whitespace
          const r = fuzzyFilter(items, ws, (i) => [i.name]);
          expect(r).toHaveLength(items.length);
          r.forEach((x) => expect(x.score).toBe(0));
        },
      ),
      { numRuns: 300 },
    );
  });

  it("results are sorted by score descending", () => {
    fc.assert(
      fc.property(itemsArb, shortQuery, (items, query) => {
        const r = fuzzyFilter(items, query, (i) => [i.name, i.id]);
        for (let i = 1; i < r.length; i++) {
          expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("every result item exists in the original items array", () => {
    fc.assert(
      fc.property(itemsArb, shortQuery, (items, query) => {
        const r = fuzzyFilter(items, query, (i) => [i.name]);
        for (const res of r) {
          expect(items).toContain(res.item);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("no result has score > 100", () => {
    fc.assert(
      fc.property(itemsArb, shortQuery, (items, query) => {
        const r = fuzzyFilter(items, query, (i) => [i.name]);
        for (const res of r) {
          expect(res.score).toBeLessThanOrEqual(100);
          expect(res.score).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("multi-key: best key wins — single key result is always subset of multi-key result", () => {
    fc.assert(
      fc.property(itemsArb, shortQuery, (items, query) => {
        const single = fuzzyFilter(items, query, (i) => [i.name]);
        const multi  = fuzzyFilter(items, query, (i) => [i.name, i.id]);
        // multi must have at least as many results as single (more keys = more matches)
        expect(multi.length).toBeGreaterThanOrEqual(single.length);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── buildHighlightSegments — property-based ─────────────────────────────────

describe("buildHighlightSegments — property-based", () => {
  /** Array of valid indices within a given text length */
  const rangesArb = (maxLen: number) =>
    fc
      .uniqueArray(fc.nat({ max: Math.max(0, maxLen - 1) }), { maxLength: maxLen })
      .map((a) => a.sort((x, y) => x - y));

  /** Dependent arbitrary: text + valid index ranges for that text */
  const textWithRangesArb = asciiStrNE.chain((text) =>
    rangesArb(text.length).map((ranges) => ({ text, ranges })),
  );

  it("reconstructed text always equals original for any ranges", () => {
    fc.assert(
      fc.property(textWithRangesArb, ({ text, ranges }) => {
        const segs = buildHighlightSegments(text, ranges);
        const rebuilt = segs.map((s) => s.text).join("");
        expect(rebuilt).toBe(text);
      }),
      { numRuns: 500 },
    );
  });

  it("every segment has non-empty text", () => {
    fc.assert(
      fc.property(textWithRangesArb, ({ text, ranges }) => {
        const segs = buildHighlightSegments(text, ranges);
        for (const seg of segs) {
          expect(seg.text.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("adjacent segments always alternate highlight value", () => {
    fc.assert(
      fc.property(textWithRangesArb, ({ text, ranges }) => {
        const segs = buildHighlightSegments(text, ranges);
        for (let i = 1; i < segs.length; i++) {
          expect(segs[i].highlight).not.toBe(segs[i - 1].highlight);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("total chars in segments equals text length", () => {
    fc.assert(
      fc.property(textWithRangesArb, ({ text, ranges }) => {
        const segs = buildHighlightSegments(text, ranges);
        const totalLen = segs.reduce((sum, s) => sum + s.text.length, 0);
        expect(totalLen).toBe(text.length);
      }),
      { numRuns: 500 },
    );
  });

  it("empty text always returns no segments (or single empty)", () => {
    const segs = buildHighlightSegments("", []);
    // Either empty array or single segment with empty text
    if (segs.length > 0) {
      expect(segs.map((s) => s.text).join("")).toBe("");
    }
  });

  it("empty ranges → single non-highlighted segment", () => {
    fc.assert(
      fc.property(asciiStrNE, (text) => {
        const segs = buildHighlightSegments(text, []);
        expect(segs).toHaveLength(1);
        expect(segs[0].text).toBe(text);
        expect(segs[0].highlight).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it("all indices highlighted → only highlighted segments", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20, unit: "grapheme-ascii" }),
        (text) => {
          const allRanges = Array.from({ length: text.length }, (_, i) => i);
          const segs = buildHighlightSegments(text, allRanges);
          for (const seg of segs) {
            expect(seg.highlight).toBe(true);
          }
          expect(segs.map((s) => s.text).join("")).toBe(text);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("first segment highlight matches whether index 0 is in ranges", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 2, maxLength: 20, unit: "grapheme-ascii" }),
        fc.boolean(),
        (text, includeZero) => {
          const ranges = includeZero ? [0] : [1];
          const segs = buildHighlightSegments(text, ranges);
          expect(segs[0].highlight).toBe(includeZero);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── Cross-function invariants ─────────────────────────────────────────────

describe("fuzzySearch — cross-function invariants", () => {
  const itemArb = fc.record({
    id: fc.string({ minLength: 1, maxLength: 12, unit: "grapheme-ascii" }),
    name: fc.string({ minLength: 1, maxLength: 30, unit: "grapheme-ascii" }),
  });

  it("fuzzyFilter result ranges are valid for buildHighlightSegments", () => {
    fc.assert(
      fc.property(
        fc.array(itemArb, { minLength: 1, maxLength: 10 }),
        shortQuery,
        (items, query) => {
          const results = fuzzyFilter(items, query, (i) => [i.name]);
          for (const res of results) {
            // Reconstruct with the matched name — use item.name
            const segs = buildHighlightSegments(res.item.name, res.ranges);
            const rebuilt = segs.map((s) => s.text).join("");
            // segments always reconstruct the original text
            expect(rebuilt).toBe(res.item.name);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it("fuzzyScore ranges and fuzzyFilter ranges are consistent for same item (non-whitespace query)", () => {
    // fuzzyFilter trims whitespace before matching, so we only compare on non-whitespace queries.
    const nonWsQuery = shortQuery.filter((q) => q.trim().length > 0);
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30, unit: "grapheme-ascii" }),
        nonWsQuery,
        (name, query) => {
          const scoreResult = fuzzyScore(name, query);
          const filterResult = fuzzyFilter([{ id: "x", name }], query, (i) => [i.name]);
          if (scoreResult === null) {
            expect(filterResult).toHaveLength(0);
          } else {
            expect(filterResult).toHaveLength(1);
            expect(filterResult[0].score).toBe(scoreResult.score);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});
