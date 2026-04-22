/**
 * lib/selftest/mutationScore.ts
 *
 * Mutation score tracking for the ULTRONOS selftest dashboard.
 *
 * Maintains an in-memory ring buffer of up to WINDOW_SIZE mutation test runs,
 * each keyed by a (short) commit SHA.  Exposes helpers to record new runs,
 * retrieve history, and compute per-commit score deltas — the numbers that
 * power the sparkline chart.
 *
 * No I/O, no side-effects beyond the module-level buffer.
 * Safe to call from API routes, server components, and test suites.
 */

// ─── Public types ─────────────────────────────────────────────────────────────

export type MutationRun = {
  /** Shortened git commit SHA (≤12 chars) */
  commitSha: string;
  /** ISO-8601 timestamp */
  ts: string;
  /** Mutation score in [0, 100] */
  score: number;
  /** Mutants that caused a test to fail (≥ 0) */
  killedMutants: number;
  /** Total mutants generated (> 0) */
  totalMutants: number;
};

export type MutationDelta = {
  commitSha: string;
  ts: string;
  score: number;
  /** score[i] – score[i-1]; null for the first entry */
  delta: number | null;
};

// ─── Ring buffer ──────────────────────────────────────────────────────────────

const WINDOW_SIZE = 30;

/** Module-level mutable store — intentionally simple. */
let _history: MutationRun[] = _seedHistory();

// ─── Seed data (provides a plausible history at cold-start) ───────────────────

function _seedHistory(): MutationRun[] {
  const commits = [
    "a1b2c3d", "e4f5a6b", "7c8d9e0", "f1a2b3c", "4d5e6f7",
    "8a9b0c1", "d2e3f4a", "5b6c7d8", "9e0f1a2", "b3c4d5e",
    "6f7a8b9", "0c1d2e3", "f4a5b6c", "7d8e9f0", "a1b2c3e",
    "4f5a6b7", "8c9d0e1", "f2a3b4c", "5d6e7f8", "9a0b1c2",
  ];

  // Simulate a score that trends upward with occasional dips
  let score = 58.0;
  const now = Date.now();

  return commits.map((sha, i) => {
    const delta = (Math.random() - 0.35) * 6; // slight upward bias
    score = Math.min(100, Math.max(0, score + delta));
    const totalMutants = 200 + Math.floor(Math.random() * 50);
    const killedMutants = Math.round((score / 100) * totalMutants);

    return {
      commitSha: sha,
      ts: new Date(now - (commits.length - i) * 3_600_000).toISOString(),
      score: parseFloat(score.toFixed(2)),
      killedMutants,
      totalMutants,
    };
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record a new mutation run.  Appends to the ring buffer, evicting the oldest
 * entry when the buffer is full (> WINDOW_SIZE).
 *
 * @returns The recorded MutationRun (with clamped score).
 */
export function recordMutationRun(
  params: Omit<MutationRun, "ts"> & { ts?: string },
): MutationRun {
  if (params.totalMutants <= 0) {
    throw new Error("totalMutants must be > 0");
  }
  const run: MutationRun = {
    ...params,
    ts: params.ts ?? new Date().toISOString(),
    score: parseFloat(
      Math.min(100, Math.max(0, params.score)).toFixed(2),
    ),
  };
  _history.push(run);
  if (_history.length > WINDOW_SIZE) {
    _history = _history.slice(_history.length - WINDOW_SIZE);
  }
  return run;
}

/**
 * Returns a snapshot of the history (oldest → newest), up to WINDOW_SIZE entries.
 * Returns a shallow copy — mutations to the returned array do not affect the store.
 */
export function getMutationHistory(): readonly MutationRun[] {
  return [..._history];
}

/**
 * Computes per-commit score deltas from the history.
 * The first entry always has delta: null.
 */
export function computeScoreDeltas(): MutationDelta[] {
  return _history.map((run, i) => ({
    commitSha: run.commitSha,
    ts: run.ts,
    score: run.score,
    delta: i === 0 ? null : parseFloat(
      (run.score - _history[i - 1].score).toFixed(2),
    ),
  }));
}

/**
 * Returns the latest mutation run, or null if history is empty.
 */
export function getLatestRun(): MutationRun | null {
  return _history.length === 0 ? null : _history[_history.length - 1];
}

/**
 * Clears history and resets to the seeded data.
 * Exposed for testing only — do not call from production code.
 */
export function _resetForTests(): void {
  _history = _seedHistory();
}

/**
 * Replaces the entire history.
 * Exposed for testing only — do not call from production code.
 */
export function _setHistoryForTests(runs: MutationRun[]): void {
  _history = runs.slice(-WINDOW_SIZE);
}
