/**
 * lib/analytics/sessionTimeline.test.ts
 *
 * Inline tests for sessionTimeline helpers.
 * Run with: npx tsx lib/analytics/sessionTimeline.test.ts
 *
 * No test-runner dependency — pure assertion-based, exits with code 0 on pass.
 */

import {
  buildSessionTimeline,
  calcRollingProjection,
  generateTimelineSeedRecords,
} from "./sessionTimeline";
import { type UsageRecord } from "./costStore";

// ─── Tiny test harness ────────────────────────────────────────────────────────

let _passed = 0;
let _failed = 0;

function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    _passed++;
  } else {
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
    _failed++;
  }
}

function assertClose(label: string, actual: number, expected: number, tol = 0.001) {
  assert(label, Math.abs(actual - expected) < tol, `got ${actual}, expected ≈ ${expected}`);
}

function suite(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date("2026-04-21T12:00:00Z").getTime();

function makeRecord(
  overrides: Partial<UsageRecord> & { ts?: string },
): UsageRecord {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    ts: overrides.ts ?? new Date(NOW).toISOString(),
    model: "claude-sonnet-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.01,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

suite("buildSessionTimeline — basic grouping", () => {
  const records: UsageRecord[] = [
    makeRecord({ ts: new Date(NOW - 10 * 60_000).toISOString(), sessionId: "s1", task: "Task A", costUsd: 0.05 }),
    makeRecord({ ts: new Date(NOW - 5 * 60_000).toISOString(), sessionId: "s1", task: "Task A", costUsd: 0.03 }),
    makeRecord({ ts: new Date(NOW - 2 * 60_000).toISOString(), sessionId: "s2", task: "Task B", costUsd: 0.10 }),
  ];

  const result = buildSessionTimeline(records);

  assert("produces 2 sessions", result.sessions.length === 2);

  // Sessions ordered newest-first (s2 has the latest record)
  assert("newest session first", result.sessions[0].sessionId === "s2");

  const s1 = result.sessions.find((s) => s.sessionId === "s1")!;
  assert("s1 exists", s1 !== undefined);
  assertClose("s1 total cost", s1.totalCostUsd, 0.08);
  assert("s1 call count", s1.totalCalls === 2);
  assert("s1 label from task", s1.label === "Task A");
});

suite("buildSessionTimeline — adhoc session (no sessionId)", () => {
  const records: UsageRecord[] = [
    makeRecord({ costUsd: 0.02 }),
    makeRecord({ costUsd: 0.02 }),
  ];

  const result = buildSessionTimeline(records);
  assert("single adhoc session", result.sessions.length === 1);
  assert(
    "adhoc sessionId",
    result.sessions[0].sessionId === "__adhoc__",
  );
});

suite("buildSessionTimeline — per-agent burn rates", () => {
  const records: UsageRecord[] = [
    makeRecord({
      ts: new Date(NOW - 60 * 60_000).toISOString(), // 60 min ago
      sessionId: "s1",
      model: "claude-opus-4",
      inputTokens: 6000,
      outputTokens: 2000,
      costUsd: 0.24,
    }),
    makeRecord({
      ts: new Date(NOW).toISOString(), // now
      sessionId: "s1",
      model: "claude-haiku-4",
      inputTokens: 2000,
      outputTokens: 500,
      costUsd: 0.004,
    }),
  ];

  const result = buildSessionTimeline(records);
  const s1 = result.sessions[0];
  assert("two agents in s1", s1.agents.length === 2);

  const opus = s1.agents.find((a) => a.model === "claude-opus-4")!;
  assert("opus agent exists", opus !== undefined);
  assert("opus total tokens", opus.totalTokens === 8000);
  assert("tokensPerMin > 0", opus.tokensPerMin > 0);
  assert("costPerHourUsd > 0", opus.costPerHourUsd > 0);

  // Most expensive model should be first
  assert(
    "agents sorted by cost desc",
    s1.agents[0].totalCostUsd >= s1.agents[s1.agents.length - 1].totalCostUsd,
  );
});

suite("buildSessionTimeline — sparklines populated", () => {
  const records: UsageRecord[] = Array.from({ length: 5 }, (_, i) =>
    makeRecord({
      ts: new Date(NOW - (5 - i) * 60_000).toISOString(),
      sessionId: "s1",
    }),
  );

  const result = buildSessionTimeline(records);
  const s1 = result.sessions[0];

  assert("cumulative sparkline has points", s1.cumulativeSparkline.length > 0);
  assert(
    "cumulative sparkline is non-decreasing",
    s1.cumulativeSparkline.every((p, i) =>
      i === 0 ? true : p.costUsd >= s1.cumulativeSparkline[i - 1].costUsd,
    ),
  );
  assert("agent sparkline has points", s1.agents[0].sparkline.length > 0);
});

suite("calcRollingProjection", () => {
  const recentRecords: UsageRecord[] = Array.from({ length: 10 }, (_, i) =>
    makeRecord({
      ts: new Date(NOW - i * 3 * 60_000).toISOString(), // every 3 min
      costUsd: 0.01,
    }),
  );

  const proj = calcRollingProjection(recentRecords, 60);
  assert("costPerHourUsd > 0", proj.costPerHourUsd > 0);
  assert("projected24hUsd > 0", proj.projected24hUsd > 0);
  assertClose(
    "projected24h ≈ 24 × hourly",
    proj.projected24hUsd,
    proj.costPerHourUsd * 24,
    0.001,
  );
  assert("windowMin preserved", proj.windowMin === 60);
});

suite("calcRollingProjection — empty window", () => {
  const proj = calcRollingProjection([], 60);
  assert("zero cost on empty", proj.costPerHourUsd === 0);
  assert("zero projection on empty", proj.projected24hUsd === 0);
});

suite("generateTimelineSeedRecords", () => {
  const records = generateTimelineSeedRecords(4);

  assert("generates records", records.length > 0);
  assert(
    "all records have sessionId",
    records.every((r) => r.sessionId !== undefined),
  );
  assert(
    "all records have valid model",
    records.every((r) => r.model.startsWith("claude-")),
  );
  assert(
    "costUsd > 0 for all",
    records.every((r) => r.costUsd > 0),
  );

  const result = buildSessionTimeline(records);
  assert("seed builds into 4 sessions", result.sessions.length === 4);
});

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n${_passed + _failed} tests: ${_passed} passed, ${_failed} failed`);

if (_failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed ✓");
}
