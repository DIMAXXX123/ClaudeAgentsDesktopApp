/**
 * Property-based tests for ULTRONOS server action pure functions.
 *
 * Covers the pure logic consumed by:
 *   /api/analytics/cost          → calcCost, aggregateRecords
 *   /api/analytics/sessions      → buildSessionTimeline, calcRollingProjection
 *   /api/analytics/waterfall     → buildWaterfallSeries, deriveCategory
 *   /api/selftest                → runSelftest (smoke: never throws)
 *   /api/search (GET parse)      → limit clamping invariant
 *
 * Uses fast-check property-based testing integrated into Vitest.
 * All functions under test are pure / deterministic (no I/O, no localStorage).
 */

import { describe, it, expect } from "vitest";
import fc from "fast-check";

import {
  calcCost,
  aggregateRecords,
  MODEL_PRICING,
  type ModelId,
  type UsageRecord,
} from "@/lib/analytics/costStore";

import {
  buildSessionTimeline,
  calcRollingProjection,
} from "@/lib/analytics/sessionTimeline";

import {
  buildWaterfallSeries,
  deriveCategory,
} from "@/lib/analytics/waterfallStore";

// ─── Shared Arbitraries ──────────────────────────────────────────────────────

const MODEL_IDS = Object.keys(MODEL_PRICING) as ModelId[];

const modelIdArb = fc.constantFrom(...MODEL_IDS);

/**
 * Generates a syntactically valid ISO-8601 timestamp within the last 7 days.
 * Using a fixed-base integer offset avoids fast-check shrinking generating
 * out-of-range Date values (fc.date() can produce invalid dates during shrink).
 */
const ONE_WEEK_AGO_MS = Date.now() - 7 * 24 * 3600_000;
const recentTsArb = fc.nat({ max: 7 * 24 * 3600_000 }).map(
  (offsetMs) => new Date(ONE_WEEK_AGO_MS + offsetMs).toISOString(),
);

/** Non-negative token count, capped to avoid extreme floating-point drift */
const tokenCountArb = fc.nat({ max: 200_000 });

/**
 * Build a realistic UsageRecord without touching localStorage.
 * costUsd is derived from calcCost so cost arithmetic invariants hold.
 */
const usageRecordArb = fc
  .record({
    id: fc.string({ minLength: 1, maxLength: 30 }),
    ts: recentTsArb,
    model: modelIdArb,
    inputTokens: tokenCountArb,
    outputTokens: tokenCountArb,
    sessionId: fc.option(
      fc.string({ minLength: 1, maxLength: 20 }),
      { nil: undefined },
    ),
    task: fc.option(
      fc.string({ minLength: 1, maxLength: 60 }),
      { nil: undefined },
    ),
  })
  .map(
    (r): UsageRecord => ({
      ...r,
      costUsd: calcCost(r.model, r.inputTokens, r.outputTokens),
    }),
  );

/** Small-to-medium arrays of records (0..30) */
const recordsArb = fc.array(usageRecordArb, { maxLength: 30 });

/** Non-empty arrays so session/waterfall invariants are meaningful */
const nonEmptyRecordsArb = fc.array(usageRecordArb, {
  minLength: 1,
  maxLength: 30,
});

// ─── calcCost ────────────────────────────────────────────────────────────────

describe("calcCost — property invariants", () => {
  it("is always non-negative for any model and any non-negative token counts", () => {
    fc.assert(
      fc.property(modelIdArb, tokenCountArb, tokenCountArb, (model, inp, out) => {
        expect(calcCost(model, inp, out)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 2000 },
    );
  });

  it("equals 0 when both token counts are 0", () => {
    fc.assert(
      fc.property(modelIdArb, (model) => {
        expect(calcCost(model, 0, 0)).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it("is strictly monotone: adding more input tokens increases cost", () => {
    fc.assert(
      fc.property(modelIdArb, tokenCountArb, tokenCountArb, fc.nat({ max: 10_000 }), (model, inp, out, extra) => {
        fc.pre(extra > 0);
        expect(calcCost(model, inp + extra, out)).toBeGreaterThan(calcCost(model, inp, out));
      }),
      { numRuns: 1000 },
    );
  });

  it("is strictly monotone: adding more output tokens increases cost", () => {
    fc.assert(
      fc.property(modelIdArb, tokenCountArb, tokenCountArb, fc.nat({ max: 10_000 }), (model, inp, out, extra) => {
        fc.pre(extra > 0);
        expect(calcCost(model, inp, out + extra)).toBeGreaterThan(calcCost(model, inp, out));
      }),
      { numRuns: 1000 },
    );
  });

  it("is additive: calcCost(m, a+b, 0) == calcCost(m,a,0) + calcCost(m,b,0)", () => {
    fc.assert(
      fc.property(modelIdArb, tokenCountArb, tokenCountArb, (model, a, b) => {
        const combined = calcCost(model, a + b, 0);
        const sum = calcCost(model, a, 0) + calcCost(model, b, 0);
        expect(Math.abs(combined - sum)).toBeLessThan(1e-9);
      }),
      { numRuns: 1000 },
    );
  });

  it("output tokens cost more than input tokens for every model", () => {
    fc.assert(
      fc.property(modelIdArb, fc.nat({ max: 1_000_000 }), (model, tokens) => {
        fc.pre(tokens > 0);
        expect(calcCost(model, 0, tokens)).toBeGreaterThan(calcCost(model, tokens, 0));
      }),
      { numRuns: 500 },
    );
  });

  it("result for all models: Opus >= Sonnet >= Haiku for same tokens", () => {
    fc.assert(
      fc.property(tokenCountArb, tokenCountArb, (inp, out) => {
        const opus = calcCost("claude-opus-4", inp, out);
        const sonnet = calcCost("claude-sonnet-4", inp, out);
        const haiku = calcCost("claude-haiku-4", inp, out);
        expect(opus).toBeGreaterThanOrEqual(sonnet);
        expect(sonnet).toBeGreaterThanOrEqual(haiku);
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── aggregateRecords ────────────────────────────────────────────────────────

describe("aggregateRecords — property invariants", () => {
  it("totalCalls always equals records.length", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const summary = aggregateRecords(records);
        expect(summary.totalCalls).toBe(records.length);
      }),
      { numRuns: 1000 },
    );
  });

  it("totalCostUsd equals sum of record costs (floating-point tolerance 1e-9)", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const summary = aggregateRecords(records);
        const expected = records.reduce((s, r) => s + r.costUsd, 0);
        expect(Math.abs(summary.totalCostUsd - expected)).toBeLessThan(1e-9);
      }),
      { numRuns: 1000 },
    );
  });

  it("byModel percentages sum to ~100 when non-empty (within 0.01%)", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const summary = aggregateRecords(records);
        const pctSum = summary.byModel.reduce((s, m) => s + m.pct, 0);
        expect(Math.abs(pctSum - 100)).toBeLessThan(0.01);
      }),
      { numRuns: 1000 },
    );
  });

  it("byModel is sorted descending by costUsd", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const summary = aggregateRecords(records);
        for (let i = 1; i < summary.byModel.length; i++) {
          expect(summary.byModel[i].costUsd).toBeLessThanOrEqual(
            summary.byModel[i - 1].costUsd,
          );
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("every byModel entry has calls > 0", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const summary = aggregateRecords(records);
        for (const agg of summary.byModel) {
          expect(agg.calls).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("totalInputTokens equals sum of individual inputTokens", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const summary = aggregateRecords(records);
        const expected = records.reduce((s, r) => s + r.inputTokens, 0);
        expect(summary.totalInputTokens).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  it("totalOutputTokens equals sum of individual outputTokens", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const summary = aggregateRecords(records);
        const expected = records.reduce((s, r) => s + r.outputTokens, 0);
        expect(summary.totalOutputTokens).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  it("merging two disjoint record sets: totalCalls is additive", () => {
    fc.assert(
      fc.property(recordsArb, recordsArb, (a, b) => {
        const combined = aggregateRecords([...a, ...b]);
        expect(combined.totalCalls).toBe(a.length + b.length);
      }),
      { numRuns: 500 },
    );
  });

  it("empty input produces a zero summary with empty byModel", () => {
    const empty = aggregateRecords([]);
    expect(empty.totalCostUsd).toBe(0);
    expect(empty.totalCalls).toBe(0);
    expect(empty.byModel).toHaveLength(0);
    expect(empty.totalInputTokens).toBe(0);
    expect(empty.totalOutputTokens).toBe(0);
  });

  it("each byModel pct is in [0, 100]", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const summary = aggregateRecords(records);
        for (const agg of summary.byModel) {
          expect(agg.pct).toBeGreaterThanOrEqual(0);
          expect(agg.pct).toBeLessThanOrEqual(100 + 1e-9);
        }
      }),
      { numRuns: 500 },
    );
  });
});

// ─── calcRollingProjection ───────────────────────────────────────────────────

describe("calcRollingProjection — property invariants", () => {
  it("always returns non-negative values", () => {
    fc.assert(
      fc.property(recordsArb, fc.integer({ min: 1, max: 1440 }), (records, win) => {
        const proj = calcRollingProjection(records, win);
        expect(proj.costPerHourUsd).toBeGreaterThanOrEqual(0);
        expect(proj.projected24hUsd).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it("windowMin is preserved in projection output", () => {
    fc.assert(
      fc.property(recordsArb, fc.integer({ min: 1, max: 1440 }), (records, win) => {
        const proj = calcRollingProjection(records, win);
        expect(proj.windowMin).toBe(win);
      }),
      { numRuns: 500 },
    );
  });

  it("projected24hUsd ≈ 24 × costPerHourUsd (rounded values, tolerance 0.005)", () => {
    // The impl independently rounds costPerHourUsd and projected24hUsd to 4 decimal places.
    // Max rounding error: 24 × (0.5/10000) + (0.5/10000) ≈ 0.00125 — use 0.005 margin.
    fc.assert(
      fc.property(nonEmptyRecordsArb, fc.integer({ min: 1, max: 120 }), (records, win) => {
        const proj = calcRollingProjection(records, win);
        expect(
          Math.abs(proj.projected24hUsd - proj.costPerHourUsd * 24),
        ).toBeLessThan(0.005);
      }),
      { numRuns: 500 },
    );
  });

  it("empty records always returns zero projection regardless of window", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1440 }), (win) => {
        const proj = calcRollingProjection([], win);
        expect(proj.costPerHourUsd).toBe(0);
        expect(proj.projected24hUsd).toBe(0);
      }),
      { numRuns: 200 },
    );
  });

  it("with same-window records, costPerHour shrinks as window grows (same cost, more time)", () => {
    // Use records with timestamps exactly 1 minute ago (within any positive window).
    // Build a dedicated record generator with a known-fresh timestamp.
    const FIXED_TS = new Date(Date.now() - 60_000).toISOString(); // 1 min ago
    const freshRecordArb = fc.record({
      id: fc.string({ minLength: 1, maxLength: 10 }),
      model: modelIdArb,
      inputTokens: tokenCountArb,
      outputTokens: tokenCountArb,
    }).map((r) => ({
      ...r,
      ts: FIXED_TS,
      costUsd: calcCost(r.model, r.inputTokens, r.outputTokens),
      sessionId: undefined,
      task: undefined,
    }));

    fc.assert(
      fc.property(
        fc.array(freshRecordArb, { minLength: 1, maxLength: 15 }),
        fc.integer({ min: 2, max: 30 }),
        fc.integer({ min: 31, max: 120 }),
        (records, shortWin, longWin) => {
          const short = calcRollingProjection(records, shortWin);
          const long = calcRollingProjection(records, longWin);
          // All records are within 1 min, so both windows include them.
          // Longer window → same cost / more minutes → lower costPerHour.
          expect(short.costPerHourUsd).toBeGreaterThanOrEqual(0);
          expect(long.costPerHourUsd).toBeGreaterThanOrEqual(0);
          // shortWin < longWin → shortWin rate >= longWin rate (both include all records)
          expect(short.costPerHourUsd).toBeGreaterThanOrEqual(long.costPerHourUsd - 1e-9);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── buildSessionTimeline ────────────────────────────────────────────────────

describe("buildSessionTimeline — property invariants", () => {
  it("never throws for any array of records", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        expect(() => buildSessionTimeline(records)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });

  it("total calls across all sessions equals records.length", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        const totalCalls = data.sessions.reduce((s, sess) => s + sess.totalCalls, 0);
        expect(totalCalls).toBe(records.length);
      }),
      { numRuns: 500 },
    );
  });

  it("total cost across all sessions equals sum of all record costs", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        const sessionTotal = data.sessions.reduce((s, sess) => s + sess.totalCostUsd, 0);
        const recordTotal = records.reduce((s, r) => s + r.costUsd, 0);
        expect(Math.abs(sessionTotal - recordTotal)).toBeLessThan(1e-9);
      }),
      { numRuns: 500 },
    );
  });

  it("each session has at least one agent", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        for (const sess of data.sessions) {
          expect(sess.agents.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("every session's agents are sorted by totalCostUsd descending", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        for (const sess of data.sessions) {
          for (let i = 1; i < sess.agents.length; i++) {
            expect(sess.agents[i].totalCostUsd).toBeLessThanOrEqual(
              sess.agents[i - 1].totalCostUsd,
            );
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it("sessions sorted descending by lastActiveAt", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        for (let i = 1; i < data.sessions.length; i++) {
          expect(
            data.sessions[i].lastActiveAt <= data.sessions[i - 1].lastActiveAt,
          ).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("each session has durationMin >= 1 (minimum enforced by impl)", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const data = buildSessionTimeline(records);
        for (const sess of data.sessions) {
          expect(sess.durationMin).toBeGreaterThanOrEqual(1);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("session.totalTokens equals sum of (inputTokens+outputTokens) for its records", () => {
    // Use a deterministic record set with a known sessionId
    fc.assert(
      fc.property(
        fc.array(
          usageRecordArb.map((r) => ({ ...r, sessionId: "fixed-session" })),
          { minLength: 1, maxLength: 10 },
        ),
        (records) => {
          const data = buildSessionTimeline(records);
          const sess = data.sessions.find((s) => s.sessionId === "fixed-session");
          if (!sess) return; // guard (shouldn't happen)
          const expected = records.reduce(
            (s, r) => s + r.inputTokens + r.outputTokens,
            0,
          );
          expect(sess.totalTokens).toBe(expected);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("projection in result always has non-negative values", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const data = buildSessionTimeline(records);
        expect(data.projection.costPerHourUsd).toBeGreaterThanOrEqual(0);
        expect(data.projection.projected24hUsd).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 300 },
    );
  });

  it("generatedAt is a valid ISO timestamp string", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const data = buildSessionTimeline(records);
        expect(() => new Date(data.generatedAt)).not.toThrow();
        expect(isNaN(new Date(data.generatedAt).getTime())).toBe(false);
      }),
      { numRuns: 200 },
    );
  });
});

// ─── deriveCategory ──────────────────────────────────────────────────────────

describe("deriveCategory — property invariants", () => {
  it("always returns a non-empty string", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        (task) => {
          const cat = deriveCategory(task);
          expect(typeof cat).toBe("string");
          expect(cat.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("undefined/null/empty task returns 'Uncategorized'", () => {
    expect(deriveCategory(undefined)).toBe("Uncategorized");
    expect(deriveCategory("")).toBe("Uncategorized");
  });

  it("is deterministic: same input always produces same output", () => {
    fc.assert(
      fc.property(
        fc.option(fc.string({ maxLength: 80 }), { nil: undefined }),
        (task) => {
          expect(deriveCategory(task)).toBe(deriveCategory(task));
        },
      ),
      { numRuns: 500 },
    );
  });

  it("UEFN-related tasks map to the UEFN/Game category", () => {
    for (const keyword of ["uefn", "UEFN", "verse", "fortnite", "Fortnite"]) {
      expect(deriveCategory(`Fix ${keyword} script`)).toBe("UEFN/Game");
    }
  });

  it("Telegram-related tasks map to Telegram category", () => {
    for (const keyword of ["telegram", "bot", "Telegram", "Bot"]) {
      expect(deriveCategory(`${keyword} integration`)).toBe("Telegram");
    }
  });
});

// ─── buildWaterfallSeries ────────────────────────────────────────────────────

describe("buildWaterfallSeries — property invariants", () => {
  const daysArb = fc.integer({ min: 1, max: 30 });

  it("never throws for any records and any day count", () => {
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        expect(() => buildWaterfallSeries(records, days)).not.toThrow();
      }),
      { numRuns: 500 },
    );
  });

  it("days array length always equals the requested days count", () => {
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        const series = buildWaterfallSeries(records, days);
        expect(series.days).toHaveLength(days);
      }),
      { numRuns: 500 },
    );
  });

  it("totalCostUsd equals sum of day bucket totals", () => {
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        const series = buildWaterfallSeries(records, days);
        const bucketsTotal = series.days.reduce((s, b) => s + b.total, 0);
        expect(Math.abs(series.totalCostUsd - bucketsTotal)).toBeLessThan(1e-9);
      }),
      { numRuns: 500 },
    );
  });

  it("each day bucket has non-negative total", () => {
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        const series = buildWaterfallSeries(records, days);
        for (const bucket of series.days) {
          expect(bucket.total).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("models array contains only ModelId values present in MODEL_PRICING or known string keys", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, daysArb, (records, days) => {
        const series = buildWaterfallSeries(records, days);
        for (const m of series.models) {
          expect(typeof m.id).toBe("string");
          expect(m.id.length).toBeGreaterThan(0);
          expect(typeof m.label).toBe("string");
          expect(typeof m.color).toBe("string");
        }
      }),
      { numRuns: 300 },
    );
  });

  it("day bucket dates are strictly ascending (one per day, no duplicates)", () => {
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        const series = buildWaterfallSeries(records, days);
        for (let i = 1; i < series.days.length; i++) {
          expect(series.days[i].date > series.days[i - 1].date).toBe(true);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("totalCostUsd is 0 when records is empty", () => {
    fc.assert(
      fc.property(daysArb, (days) => {
        const series = buildWaterfallSeries([], days);
        expect(series.totalCostUsd).toBe(0);
        expect(series.models).toHaveLength(0);
        expect(series.categories).toHaveLength(0);
      }),
      { numRuns: 200 },
    );
  });

  it("adding a record within the window can only increase or maintain totalCostUsd", () => {
    // Any record dated yesterday or today is within any days >= 1 window
    fc.assert(
      fc.property(
        recordsArb,
        daysArb,
        usageRecordArb.map((r) => ({
          ...r,
          ts: new Date(Date.now() - 3600_000).toISOString(), // 1 hour ago, always in window
          costUsd: Math.abs(r.costUsd), // guarantee positive
        })),
        (records, days, extra) => {
          const before = buildWaterfallSeries(records, days);
          const after = buildWaterfallSeries([...records, extra], days);
          expect(after.totalCostUsd).toBeGreaterThanOrEqual(before.totalCostUsd - 1e-9);
        },
      ),
      { numRuns: 300 },
    );
  });
});

// ─── Search limit clamping invariant (extracted from route) ──────────────────

describe("GET /api/search — limit clamping logic (pure extract)", () => {
  /**
   * The route does: Math.min(100, Math.max(1, parseInt(raw) || 20))
   * We test this invariant property-based without spinning up Next.js.
   */
  function clampLimit(raw: string | null): number {
    return Math.min(100, Math.max(1, parseInt(raw ?? "", 10) || 20));
  }

  it("clamped limit is always in [1, 100]", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 1000 }).map(String),
          fc.constant(""),
          fc.constant("abc"),
          fc.constant("0"),
          fc.constant("101"),
          fc.constant(null),
        ),
        (raw) => {
          const limit = clampLimit(raw as string | null);
          expect(limit).toBeGreaterThanOrEqual(1);
          expect(limit).toBeLessThanOrEqual(100);
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("defaults to 20 for non-numeric or empty input", () => {
    expect(clampLimit("")).toBe(20);
    expect(clampLimit("abc")).toBe(20);
    expect(clampLimit(null)).toBe(20);
    expect(clampLimit("0")).toBe(20); // parseInt("0") = 0 → falsy → default 20
  });

  it("clamps high values to 100", () => {
    fc.assert(
      fc.property(fc.integer({ min: 101, max: 1_000_000 }), (n) => {
        expect(clampLimit(String(n))).toBe(100);
      }),
      { numRuns: 500 },
    );
  });

  it("clamps low values to 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 0 }), (n) => {
        fc.pre(n !== 0); // 0 is falsy → defaults to 20, not clamped to 1
        expect(clampLimit(String(n))).toBe(1);
      }),
      { numRuns: 500 },
    );
  });

  it("passes through valid values in [1, 100] unchanged", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 100 }), (n) => {
        expect(clampLimit(String(n))).toBe(n);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── Cross-cutting: calcCost consistency in records ──────────────────────────

describe("UsageRecord cost consistency — cross-function invariants", () => {
  it("aggregateRecords totalCostUsd matches re-computing calcCost for each record", () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const recomputed = records.reduce(
          (s, r) => s + calcCost(r.model, r.inputTokens, r.outputTokens),
          0,
        );
        const summary = aggregateRecords(records);
        // Allow small FP drift from the two independent summation paths
        expect(Math.abs(summary.totalCostUsd - recomputed)).toBeLessThan(1e-6);
      }),
      { numRuns: 1000 },
    );
  });

  it("buildSessionTimeline + aggregateRecords agree on totalCost for same records", () => {
    fc.assert(
      fc.property(nonEmptyRecordsArb, (records) => {
        const timeline = buildSessionTimeline(records);
        const summary = aggregateRecords(records);
        const timelineTotal = timeline.sessions.reduce((s, sess) => s + sess.totalCostUsd, 0);
        expect(Math.abs(timelineTotal - summary.totalCostUsd)).toBeLessThan(1e-9);
      }),
      { numRuns: 500 },
    );
  });

  it("buildWaterfallSeries totalCostUsd <= aggregateRecords totalCostUsd (older records excluded by window)", () => {
    // Waterfall only counts records within the `days` window;
    // aggregateRecords counts all records → waterfall total ≤ full total
    fc.assert(
      fc.property(recordsArb, daysArb, (records, days) => {
        const waterfall = buildWaterfallSeries(records, days);
        const summary = aggregateRecords(records);
        expect(waterfall.totalCostUsd).toBeLessThanOrEqual(
          summary.totalCostUsd + 1e-9, // floating-point guard
        );
      }),
      { numRuns: 500 },
    );
  });
});

// Local helper re-use
const daysArb = fc.integer({ min: 1, max: 30 });
