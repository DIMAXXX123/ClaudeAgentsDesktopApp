/**
 * lib/analytics/modelBreakdown.test.ts
 *
 * Vitest unit tests for buildModelBreakdown and breakdownToCsv.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  buildModelBreakdown,
  breakdownToCsv,
  type ModelBreakdownResult,
} from "./modelBreakdown";
import { calcCost, type UsageRecord } from "./costStore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(
  opts: Partial<UsageRecord> & { daysAgo?: number } = {},
): UsageRecord {
  const daysAgo = opts.daysAgo ?? 0;
  const ts = new Date(Date.now() - daysAgo * 24 * 3600 * 1000).toISOString();
  const model = opts.model ?? "claude-sonnet-4";
  const inputTokens = opts.inputTokens ?? 1_000;
  const outputTokens = opts.outputTokens ?? 200;
  return {
    id: opts.id ?? `test-${Math.random().toString(36).slice(2)}`,
    ts,
    model,
    inputTokens,
    outputTokens,
    costUsd: opts.costUsd ?? calcCost(model, inputTokens, outputTokens),
    sessionId: opts.sessionId,
    task: opts.task,
  };
}

// ─── buildModelBreakdown ──────────────────────────────────────────────────────

describe("buildModelBreakdown", () => {
  it("returns empty result for no records", () => {
    const result = buildModelBreakdown([], 7);
    expect(result.rows).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
    expect(result.totalCalls).toBe(0);
    expect(result.periodDays).toBe(7);
  });

  it("excludes records older than the window", () => {
    const old = makeRecord({ daysAgo: 10, model: "claude-opus-4" });
    const result = buildModelBreakdown([old], 7);
    expect(result.rows).toHaveLength(0);
    expect(result.totalCostUsd).toBe(0);
  });

  it("accumulates calls and tokens per model", () => {
    const r1 = makeRecord({ model: "claude-haiku-4", inputTokens: 500, outputTokens: 100 });
    const r2 = makeRecord({ model: "claude-haiku-4", inputTokens: 1500, outputTokens: 300 });
    const result = buildModelBreakdown([r1, r2], 7);
    const row = result.rows.find((r) => r.model === "claude-haiku-4")!;
    expect(row).toBeDefined();
    expect(row.calls).toBe(2);
    expect(row.inputTokens).toBe(2000);
    expect(row.outputTokens).toBe(400);
    expect(row.totalTokens).toBe(2400);
  });

  it("calculates costUsd correctly", () => {
    const r = makeRecord({ model: "claude-opus-4", inputTokens: 1_000_000, outputTokens: 0 });
    const result = buildModelBreakdown([r], 7);
    const row = result.rows[0];
    expect(row.costUsd).toBeCloseTo(15, 6); // $15 per 1M input tokens for opus-4
  });

  it("computes avgCostPerCall", () => {
    const r1 = makeRecord({ model: "claude-sonnet-4", inputTokens: 1000, outputTokens: 200 });
    const r2 = makeRecord({ model: "claude-sonnet-4", inputTokens: 3000, outputTokens: 600 });
    const result = buildModelBreakdown([r1, r2], 7);
    const row = result.rows.find((r) => r.model === "claude-sonnet-4")!;
    expect(row.avgCostPerCall).toBeCloseTo(row.costUsd / 2, 10);
  });

  it("pctOfTotal sums to 100 across all rows", () => {
    const records = [
      makeRecord({ model: "claude-opus-4", inputTokens: 10_000, outputTokens: 2_000 }),
      makeRecord({ model: "claude-sonnet-4", inputTokens: 5_000, outputTokens: 1_000 }),
      makeRecord({ model: "claude-haiku-4", inputTokens: 2_000, outputTokens: 400 }),
    ];
    const result = buildModelBreakdown(records, 7);
    const pctSum = result.rows.reduce((s, r) => s + r.pctOfTotal, 0);
    expect(Math.abs(pctSum - 100)).toBeLessThan(0.0001);
  });

  it("rows are sorted by costUsd descending", () => {
    const records = [
      makeRecord({ model: "claude-haiku-4", inputTokens: 100, outputTokens: 20 }),
      makeRecord({ model: "claude-opus-4", inputTokens: 50_000, outputTokens: 10_000 }),
      makeRecord({ model: "claude-sonnet-4", inputTokens: 2_000, outputTokens: 400 }),
    ];
    const result = buildModelBreakdown(records, 7);
    for (let i = 1; i < result.rows.length; i++) {
      expect(result.rows[i - 1].costUsd).toBeGreaterThanOrEqual(result.rows[i].costUsd);
    }
  });

  it("totals match sum of individual rows", () => {
    const records = [
      makeRecord({ model: "claude-opus-4", inputTokens: 5_000, outputTokens: 1_000 }),
      makeRecord({ model: "claude-haiku-4", inputTokens: 3_000, outputTokens: 600 }),
    ];
    const result = buildModelBreakdown(records, 7);
    const rowCostSum = result.rows.reduce((s, r) => s + r.costUsd, 0);
    const rowCallSum = result.rows.reduce((s, r) => s + r.calls, 0);
    expect(result.totalCostUsd).toBeCloseTo(rowCostSum, 10);
    expect(result.totalCalls).toBe(rowCallSum);
  });

  it("uses MODEL_PRICING label and color for known models", () => {
    const result = buildModelBreakdown([makeRecord({ model: "claude-opus-4" })], 7);
    expect(result.rows[0].label).toBe("Opus 4");
    expect(result.rows[0].color).toBe("#a78bfa");
  });
});

// ─── breakdownToCsv ───────────────────────────────────────────────────────────

describe("breakdownToCsv", () => {
  let result: ModelBreakdownResult;

  beforeEach(() => {
    result = buildModelBreakdown(
      [
        makeRecord({ model: "claude-opus-4", inputTokens: 10_000, outputTokens: 2_000 }),
        makeRecord({ model: "claude-haiku-4", inputTokens: 500, outputTokens: 100 }),
      ],
      7,
    );
  });

  it("starts with header row", () => {
    const csv = breakdownToCsv(result);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toContain("Model");
    expect(firstLine).toContain("Cost USD");
    expect(firstLine).toContain("% of Total");
  });

  it("has a TOTAL summary row at the end", () => {
    const csv = breakdownToCsv(result);
    const lastLine = csv.split("\n").at(-1)!;
    expect(lastLine).toContain("TOTAL");
    expect(lastLine).toContain("100.00");
  });

  it("row count = 1 header + N model rows + 1 total", () => {
    const csv = breakdownToCsv(result);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(1 + result.rows.length + 1);
  });

  it("csv values escape quotes properly", () => {
    // edge case: model label containing comma (hypothetical)
    const fakeResult: ModelBreakdownResult = {
      rows: [
        {
          model: 'model,"test"',
          label: 'Label, "quoted"',
          color: "#000",
          calls: 1,
          inputTokens: 100,
          outputTokens: 20,
          totalTokens: 120,
          costUsd: 0.001,
          avgCostPerCall: 0.001,
          pctOfTotal: 100,
        },
      ],
      totalCostUsd: 0.001,
      totalCalls: 1,
      totalInputTokens: 100,
      totalOutputTokens: 20,
      periodDays: 7,
    };
    const csv = breakdownToCsv(fakeResult);
    expect(csv).toContain('"Label, ""quoted"""');
  });
});
