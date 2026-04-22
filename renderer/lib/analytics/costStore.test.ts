/**
 * lib/analytics/costStore.test.ts
 *
 * Inline unit tests for the analytics/costStore pure functions.
 * Run via: npx tsx lib/analytics/costStore.test.ts
 * (no test runner dependency needed — uses Node assert)
 */

import assert from "node:assert/strict";
import {
  calcCost,
  aggregateRecords,
  generateSeedRecords,
  MODEL_PRICING,
  type UsageRecord,
} from "./costStore";

// ─── calcCost ─────────────────────────────────────────────────────────────────

// Opus 4: $15/1M input + $75/1M output
const opusCost = calcCost("claude-opus-4", 1_000_000, 1_000_000);
assert.equal(opusCost, 15 + 75, "opus-4 1M+1M tokens = $90");

// Haiku 4.5: $0.8/1M input + $4/1M output
const haikuCost = calcCost("claude-haiku-4-5", 1_000_000, 1_000_000);
assert.equal(haikuCost, 0.8 + 4, "haiku-4-5 1M+1M tokens = $4.80");

// Zero tokens = zero cost
assert.equal(calcCost("claude-sonnet-4", 0, 0), 0, "zero tokens = $0");

// Fractional: 1000 input tokens of sonnet-4 ($3/1M = $0.000003 per token)
const sonnCost = calcCost("claude-sonnet-4", 1000, 0);
assert.ok(
  Math.abs(sonnCost - 0.003) < 1e-10,
  `sonnet-4 1k input = $0.003, got ${sonnCost}`,
);

// ─── aggregateRecords ─────────────────────────────────────────────────────────

const sampleRecords: UsageRecord[] = [
  {
    id: "t1",
    ts: new Date().toISOString(),
    model: "claude-opus-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: calcCost("claude-opus-4", 1000, 500),
  },
  {
    id: "t2",
    ts: new Date().toISOString(),
    model: "claude-sonnet-4-5",
    inputTokens: 2000,
    outputTokens: 800,
    costUsd: calcCost("claude-sonnet-4-5", 2000, 800),
  },
  {
    id: "t3",
    ts: new Date().toISOString(),
    model: "claude-opus-4",
    inputTokens: 500,
    outputTokens: 200,
    costUsd: calcCost("claude-opus-4", 500, 200),
  },
];

const summary = aggregateRecords(sampleRecords);

assert.equal(summary.totalCalls, 3, "totalCalls = 3");
assert.equal(summary.byModel.length, 2, "2 distinct models");

const opusAgg = summary.byModel.find((m) => m.model === "claude-opus-4");
assert.ok(opusAgg, "opus aggregate exists");
assert.equal(opusAgg!.calls, 2, "opus has 2 calls");
assert.equal(opusAgg!.inputTokens, 1500, "opus 1500 input tokens");

// Percentages sum to ~100 (allow floating point)
const pctSum = summary.byModel.reduce((s, m) => s + m.pct, 0);
assert.ok(Math.abs(pctSum - 100) < 0.01, `pcts sum to 100, got ${pctSum}`);

// byModel sorted descending by cost
assert.ok(
  summary.byModel[0].costUsd >= summary.byModel[summary.byModel.length - 1].costUsd,
  "byModel sorted desc by cost",
);

// totalCostUsd matches sum of record costs
const manualTotal = sampleRecords.reduce((s, r) => s + r.costUsd, 0);
assert.ok(
  Math.abs(summary.totalCostUsd - manualTotal) < 1e-10,
  "totalCostUsd matches manual sum",
);

// ─── Empty records ────────────────────────────────────────────────────────────

const emptySummary = aggregateRecords([]);
assert.equal(emptySummary.totalCostUsd, 0);
assert.equal(emptySummary.totalCalls, 0);
assert.equal(emptySummary.byModel.length, 0);

// ─── generateSeedRecords ──────────────────────────────────────────────────────

const seeds = generateSeedRecords(30);
assert.equal(seeds.length, 30, "generates exact count");

for (const r of seeds) {
  // id / ts / model present
  assert.ok(r.id, "record has id");
  assert.ok(r.ts, "record has ts");
  assert.ok(r.model in MODEL_PRICING, `model ${r.model} is known`);

  // cost matches re-computation
  const expected = calcCost(r.model, r.inputTokens, r.outputTokens);
  assert.ok(
    Math.abs(r.costUsd - expected) < 1e-10,
    `record ${r.id} cost matches calcCost`,
  );

  // tokens non-negative
  assert.ok(r.inputTokens >= 0, "inputTokens >= 0");
  assert.ok(r.outputTokens >= 0, "outputTokens >= 0");
}

// Seeds sorted ascending by ts
for (let i = 1; i < seeds.length; i++) {
  assert.ok(
    new Date(seeds[i].ts) >= new Date(seeds[i - 1].ts),
    "seeds sorted ascending",
  );
}

console.log("✅  costStore.test.ts — all assertions passed");
