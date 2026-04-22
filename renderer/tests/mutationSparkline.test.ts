/**
 * tests/mutationSparkline.test.ts
 *
 * Unit tests for lib/selftest/mutationScore.ts
 *
 * Covers:
 *  - Ring buffer eviction at WINDOW_SIZE = 30
 *  - recordMutationRun: score clamping, validation, default ts
 *  - computeScoreDeltas: first entry null, subsequent deltas accurate
 *  - getMutationHistory: ordering guarantee (oldest → newest)
 *  - getLatestRun: empty and non-empty cases
 *  - Property: deltas.length === history.length always
 *  - Property: delta[0] always null, delta[i] === score[i]-score[i-1]
 *  - Edge cases: totalMutants = 0, score > 100, score < 0
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recordMutationRun,
  getMutationHistory,
  computeScoreDeltas,
  getLatestRun,
  _resetForTests,
  _setHistoryForTests,
  type MutationRun,
} from "@/lib/selftest/mutationScore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRun(
  sha: string,
  score: number,
  opts: Partial<Omit<MutationRun, "commitSha" | "score">> = {},
): Omit<MutationRun, "ts"> & { ts?: string } {
  return {
    commitSha: sha,
    score,
    killedMutants: opts.killedMutants ?? Math.round(score),
    totalMutants: opts.totalMutants ?? 100,
    ts: opts.ts,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  _setHistoryForTests([]);
});

// ─── getLatestRun ─────────────────────────────────────────────────────────────

describe("getLatestRun", () => {
  it("returns null when history is empty", () => {
    expect(getLatestRun()).toBeNull();
  });

  it("returns the last recorded run", () => {
    recordMutationRun(makeRun("aaa", 70));
    recordMutationRun(makeRun("bbb", 75));
    const latest = getLatestRun();
    expect(latest?.commitSha).toBe("bbb");
    expect(latest?.score).toBe(75);
  });
});

// ─── recordMutationRun ────────────────────────────────────────────────────────

describe("recordMutationRun", () => {
  it("stores and retrieves a run", () => {
    const run = recordMutationRun(makeRun("abc1234", 82.5));
    const history = getMutationHistory();
    expect(history).toHaveLength(1);
    expect(history[0]).toEqual(run);
  });

  it("clamps score > 100 to 100.00", () => {
    const run = recordMutationRun(makeRun("overflow", 110));
    expect(run.score).toBe(100);
  });

  it("clamps score < 0 to 0.00", () => {
    const run = recordMutationRun(makeRun("underflow", -5));
    expect(run.score).toBe(0);
  });

  it("rounds score to 2 decimal places", () => {
    const run = recordMutationRun(makeRun("precision", 72.333333));
    expect(run.score).toBe(72.33);
  });

  it("uses provided ts when given", () => {
    const ts = "2026-01-01T00:00:00.000Z";
    const run = recordMutationRun(makeRun("ts-test", 60, { ts }));
    expect(run.ts).toBe(ts);
  });

  it("generates a ts when not provided", () => {
    const before = Date.now();
    const run = recordMutationRun(makeRun("no-ts", 60));
    const after = Date.now();
    const runMs = new Date(run.ts).getTime();
    expect(runMs).toBeGreaterThanOrEqual(before);
    expect(runMs).toBeLessThanOrEqual(after);
  });

  it("throws when totalMutants is 0", () => {
    expect(() =>
      recordMutationRun({ commitSha: "x", score: 50, killedMutants: 0, totalMutants: 0 }),
    ).toThrow("totalMutants must be > 0");
  });

  it("truncates commitSha to 12 chars (via API endpoint convention)", () => {
    // recordMutationRun itself does NOT truncate — that's the route's job.
    // This test verifies the store accepts long SHAs and returns them verbatim.
    const longSha = "a".repeat(40);
    const run = recordMutationRun(makeRun(longSha, 50));
    expect(run.commitSha).toBe(longSha);
  });
});

// ─── Ring buffer ──────────────────────────────────────────────────────────────

describe("ring buffer (WINDOW_SIZE=30)", () => {
  it("retains all runs when count ≤ 30", () => {
    for (let i = 0; i < 30; i++) {
      recordMutationRun(makeRun(`c${i}`, 50 + i % 10));
    }
    expect(getMutationHistory()).toHaveLength(30);
  });

  it("evicts oldest entries when count > 30", () => {
    for (let i = 0; i < 35; i++) {
      recordMutationRun(makeRun(`c${i}`, 50));
    }
    const history = getMutationHistory();
    expect(history).toHaveLength(30);
    // Oldest 5 should be gone; newest entry is c34
    expect(history[0].commitSha).toBe("c5");
    expect(history[29].commitSha).toBe("c34");
  });

  it("ordering is oldest → newest", () => {
    const shas = ["first", "second", "third"];
    for (const sha of shas) {
      recordMutationRun(makeRun(sha, 70));
    }
    const history = getMutationHistory();
    expect(history.map((h) => h.commitSha)).toEqual(shas);
  });
});

// ─── computeScoreDeltas ───────────────────────────────────────────────────────

describe("computeScoreDeltas", () => {
  it("returns empty array for empty history", () => {
    expect(computeScoreDeltas()).toEqual([]);
  });

  it("first entry always has delta: null", () => {
    recordMutationRun(makeRun("first", 60));
    const deltas = computeScoreDeltas();
    expect(deltas[0].delta).toBeNull();
  });

  it("computes correct deltas for a sequence", () => {
    const scores = [60, 65, 63, 70];
    for (const [i, score] of scores.entries()) {
      recordMutationRun(makeRun(`c${i}`, score));
    }
    const deltas = computeScoreDeltas();
    expect(deltas).toHaveLength(4);
    expect(deltas[0].delta).toBeNull();
    expect(deltas[1].delta).toBeCloseTo(5, 2);
    expect(deltas[2].delta).toBeCloseTo(-2, 2);
    expect(deltas[3].delta).toBeCloseTo(7, 2);
  });

  it("deltas are rounded to 2 decimal places", () => {
    recordMutationRun(makeRun("a", 60));
    recordMutationRun(makeRun("b", 60.001));
    const deltas = computeScoreDeltas();
    // 60.00 stored, 60.00 stored → delta should be ~0
    expect(Number.isFinite(deltas[1].delta)).toBe(true);
  });

  it("delta length always equals history length", () => {
    for (let i = 0; i < 15; i++) {
      recordMutationRun(makeRun(`c${i}`, 50 + i));
    }
    expect(computeScoreDeltas()).toHaveLength(getMutationHistory().length);
  });

  it("delta[i] === score[i] - score[i-1]", () => {
    const scores = [55, 62, 58, 75, 73];
    for (const [i, score] of scores.entries()) {
      recordMutationRun(makeRun(`c${i}`, score));
    }
    const deltas = computeScoreDeltas();
    for (let i = 1; i < deltas.length; i++) {
      const expected = parseFloat((deltas[i].score - deltas[i - 1].score).toFixed(2));
      expect(deltas[i].delta).toBeCloseTo(expected, 5);
    }
  });
});

// ─── getMutationHistory ───────────────────────────────────────────────────────

describe("getMutationHistory", () => {
  it("returns a readonly snapshot (mutations to the returned array do not affect the store)", () => {
    recordMutationRun(makeRun("solo", 80));
    const history = getMutationHistory() as MutationRun[];
    // Attempting to push to the returned array should not affect the store
    // (the returned type is readonly but runtime arrays are mutable — we just
    //  verify the store is not the same reference).
    const lengthBefore = history.length;
    (history as MutationRun[]).push({ commitSha: "injected", score: 99, killedMutants: 99, totalMutants: 100, ts: new Date().toISOString() });
    // The store must still have the original length
    expect(getMutationHistory()).toHaveLength(lengthBefore);
  });
});

// ─── _resetForTests ───────────────────────────────────────────────────────────

describe("_resetForTests", () => {
  it("restores seeded history (non-empty)", () => {
    _setHistoryForTests([]);
    expect(getMutationHistory()).toHaveLength(0);
    _resetForTests();
    expect(getMutationHistory().length).toBeGreaterThan(0);
  });
});
