/**
 * lib/analytics/waterfallStore.test.ts
 *
 * Unit-tests for buildWaterfallSeries and deriveCategory.
 * Uses Vitest (already a devDep in this project).
 */

import { describe, it, expect } from "vitest";
import { buildWaterfallSeries, deriveCategory } from "./waterfallStore";
import { calcCost, type UsageRecord } from "./costStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(
  opts: Partial<UsageRecord> & { daysAgo?: number },
): UsageRecord {
  const daysAgo = opts.daysAgo ?? 0;
  const ts = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
  const model = opts.model ?? "claude-sonnet-4";
  const inputTokens = opts.inputTokens ?? 1000;
  const outputTokens = opts.outputTokens ?? 200;
  return {
    id: opts.id ?? `test-${Math.random()}`,
    ts,
    model,
    inputTokens,
    outputTokens,
    costUsd: opts.costUsd ?? calcCost(model, inputTokens, outputTokens),
    sessionId: opts.sessionId,
    task: opts.task,
  };
}

// ─── deriveCategory ───────────────────────────────────────────────────────────

describe("deriveCategory", () => {
  it("maps UEFN task to UEFN/Game", () => {
    expect(deriveCategory("UEFN map refactor")).toBe("UEFN/Game");
  });

  it("maps telegram bot task to Telegram", () => {
    expect(deriveCategory("Telegram bot fix")).toBe("Telegram");
  });

  it("maps Next.js dashboard to Frontend", () => {
    expect(deriveCategory("Next.js dashboard")).toBe("Frontend");
  });

  it("maps db schema migration to Database", () => {
    expect(deriveCategory("DB schema migration")).toBe("Database");
  });

  it("maps agent overnight run to Agent Ops", () => {
    expect(deriveCategory("Overnight agent run")).toBe("Agent Ops");
  });

  it("returns Uncategorized for undefined", () => {
    expect(deriveCategory(undefined)).toBe("Uncategorized");
  });

  it("returns Other for unknown task", () => {
    expect(deriveCategory("Random unknown task")).toBe("Other");
  });
});

// ─── buildWaterfallSeries ─────────────────────────────────────────────────────

describe("buildWaterfallSeries", () => {
  it("returns correct number of day buckets", () => {
    const series = buildWaterfallSeries([], 7);
    expect(series.days).toHaveLength(7);
  });

  it("buckets are in chronological order (oldest first)", () => {
    const series = buildWaterfallSeries([], 7);
    for (let i = 1; i < series.days.length; i++) {
      expect(series.days[i].date >= series.days[i - 1].date).toBe(true);
    }
  });

  it("accumulates costs by model into the correct date bucket", () => {
    const r = makeRecord({ daysAgo: 0, model: "claude-opus-4", task: "code" });
    const series = buildWaterfallSeries([r], 7);

    const todayBucket = series.days[series.days.length - 1];
    expect(todayBucket.byModel["claude-opus-4"]).toBeCloseTo(r.costUsd, 10);
    expect(todayBucket.total).toBeCloseTo(r.costUsd, 10);
  });

  it("excludes records older than the window", () => {
    const old = makeRecord({ daysAgo: 30, model: "claude-haiku-4" });
    const series = buildWaterfallSeries([old], 7);
    expect(series.totalCostUsd).toBe(0);
    for (const b of series.days) {
      expect(b.total).toBe(0);
    }
  });

  it("accumulates multiple records on same day", () => {
    const r1 = makeRecord({
      daysAgo: 1,
      model: "claude-sonnet-4",
      inputTokens: 1000,
      outputTokens: 200,
    });
    const r2 = makeRecord({
      daysAgo: 1,
      model: "claude-sonnet-4",
      inputTokens: 500,
      outputTokens: 100,
    });
    const series = buildWaterfallSeries([r1, r2], 7);
    const bucket = series.days.find((b) => b.byModel["claude-sonnet-4"])!;
    expect(bucket.byModel["claude-sonnet-4"]).toBeCloseTo(
      r1.costUsd + r2.costUsd,
      10,
    );
  });

  it("lists models sorted by total cost descending", () => {
    const cheap = makeRecord({
      daysAgo: 0,
      model: "claude-haiku-4",
      inputTokens: 500,
      outputTokens: 100,
    });
    const expensive = makeRecord({
      daysAgo: 0,
      model: "claude-opus-4",
      inputTokens: 50_000,
      outputTokens: 10_000,
    });
    const series = buildWaterfallSeries([cheap, expensive], 7);
    expect(series.models[0].id).toBe("claude-opus-4");
    expect(series.models[1].id).toBe("claude-haiku-4");
  });

  it("totalCostUsd equals sum of all bucket totals", () => {
    const records = [
      makeRecord({ daysAgo: 0, model: "claude-haiku-4" }),
      makeRecord({ daysAgo: 1, model: "claude-sonnet-4" }),
      makeRecord({ daysAgo: 2, model: "claude-opus-4" }),
    ];
    const series = buildWaterfallSeries(records, 7);
    const sumBuckets = series.days.reduce((s, b) => s + b.total, 0);
    expect(series.totalCostUsd).toBeCloseTo(sumBuckets, 10);
  });

  it("populates byCategory using task field", () => {
    const r = makeRecord({ daysAgo: 0, task: "UEFN map refactor" });
    const series = buildWaterfallSeries([r], 7);
    const today = series.days[series.days.length - 1];
    expect(today.byCategory["UEFN/Game"]).toBeCloseTo(r.costUsd, 10);
  });

  it("handles empty records gracefully", () => {
    const series = buildWaterfallSeries([], 30);
    expect(series.totalCostUsd).toBe(0);
    expect(series.models).toHaveLength(0);
    expect(series.categories).toHaveLength(0);
  });
});
