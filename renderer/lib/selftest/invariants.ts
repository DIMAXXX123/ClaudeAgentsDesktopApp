/**
 * lib/selftest/invariants.ts
 *
 * Runtime invariant checkers for ULTRONOS core reducers.
 * These are deterministic, side-effect-free predicates that can be called
 * from monitoring endpoints (app/api/selftest) or inline during development.
 *
 * Each exported function returns { ok: boolean; violations: string[] }.
 */

import {
  levelFromCounters,
  xpValue,
  xpForLevel,
  rankFromLevel,
  nextRank,
  progressInLevel,
  RANKS,
} from "@/lib/rank";

export type InvariantResult = {
  name: string;
  ok: boolean;
  violations: string[];
};

// ─── Rank invariants ─────────────────────────────────────────────────────────

/**
 * Spot-checks rank.ts pure functions with a matrix of known inputs.
 * Useful as a quick smoke-test that doesn't require fast-check at runtime.
 */
export function checkRankInvariants(): InvariantResult {
  const violations: string[] = [];

  // 1. RANKS must be sorted by minLevel ascending
  for (let i = 1; i < RANKS.length; i++) {
    if (RANKS[i].minLevel <= RANKS[i - 1].minLevel) {
      violations.push(
        `RANKS[${i}].minLevel=${RANKS[i].minLevel} is not > RANKS[${i - 1}].minLevel=${RANKS[i - 1].minLevel}`,
      );
    }
  }

  // 2. xpForLevel must be strictly increasing for levels 0-30
  for (let l = 0; l < 30; l++) {
    if (xpForLevel(l + 1) <= xpForLevel(l)) {
      violations.push(`xpForLevel(${l + 1}) <= xpForLevel(${l})`);
    }
  }

  // 3. progressInLevel must be in [0, 1] for a grid of inputs
  const testLevels = [0, 1, 2, 5, 10, 15, 20];
  const testXps = [0, 1, 5, 10, 100, 500, 10_000];
  for (const level of testLevels) {
    for (const xp of testXps) {
      const p = progressInLevel(xp, level);
      if (p < 0 || p > 1) {
        violations.push(`progressInLevel(xp=${xp}, level=${level})=${p} outside [0,1]`);
      }
    }
  }

  // 4. rankFromLevel(level).minLevel <= level for levels 0-20
  for (let level = 0; level <= 20; level++) {
    const rank = rankFromLevel(level);
    if (rank.minLevel > level) {
      violations.push(
        `rankFromLevel(${level}).minLevel=${rank.minLevel} > level`,
      );
    }
  }

  // 5. nextRank: when not null, minLevel > current level
  for (let level = 0; level <= 20; level++) {
    const next = nextRank(level);
    if (next !== null && next.minLevel <= level) {
      violations.push(
        `nextRank(${level}).minLevel=${next.minLevel} <= level`,
      );
    }
  }

  // 6. xpValue is additive: xpValue(a+1, b) - xpValue(a, b) == 1
  for (let a = 0; a < 10; a++) {
    for (let b = 0; b < 10; b++) {
      if (xpValue(a + 1, b) - xpValue(a, b) !== 1) {
        violations.push(`xpValue(${a}+1, ${b}) - xpValue(${a}, ${b}) != 1`);
      }
      if (xpValue(a, b + 1) - xpValue(a, b) !== 2) {
        violations.push(`xpValue(${a}, ${b}+1) - xpValue(${a}, ${b}) != 2`);
      }
    }
  }

  // 7. levelFromCounters is always non-negative
  const samplePairs: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0, 1],
    [100, 50],
    [1000, 1000],
  ];
  for (const [msgs, tools] of samplePairs) {
    const lvl = levelFromCounters(msgs, tools);
    if (lvl < 0) {
      violations.push(`levelFromCounters(${msgs}, ${tools})=${lvl} is negative`);
    }
    if (!Number.isInteger(lvl)) {
      violations.push(`levelFromCounters(${msgs}, ${tools})=${lvl} is not an integer`);
    }
  }

  return {
    name: "rank-invariants",
    ok: violations.length === 0,
    violations,
  };
}

// ─── ActivityStore invariants ────────────────────────────────────────────────

import { activityStore } from "@/lib/activityStore";

/**
 * Verifies activityStore state machine invariants at the current moment:
 * - snapshot() only contains "working" or "error" keys (never "idle")
 * - get() vs snapshot() are consistent
 */
export function checkActivityStoreInvariants(agentIds: string[]): InvariantResult {
  const violations: string[] = [];
  const snap = activityStore.snapshot();

  // 1. No "idle" in snapshot
  for (const [id, val] of Object.entries(snap)) {
    if (val === "idle") {
      violations.push(`snapshot["${id}"] === "idle" — should be absent, not present`);
    }
  }

  // 2. get() is consistent with snapshot()
  for (const id of agentIds) {
    const fromGet = activityStore.get(id);
    const fromSnap = snap[id] ?? "idle";
    if (fromGet !== fromSnap) {
      violations.push(
        `activityStore.get("${id}")="${fromGet}" != snapshot["${id}"]="${fromSnap}"`,
      );
    }
  }

  return {
    name: "activityStore-invariants",
    ok: violations.length === 0,
    violations,
  };
}

// ─── FuzzySearch invariants ──────────────────────────────────────────────────

import {
  fuzzyScore,
  fuzzyFilter,
  buildHighlightSegments,
} from "@/lib/orchestration/fuzzySearch";

/**
 * Runtime spot-checks for the fuzzy search engine.
 * Covers: empty-query contract, score bounds, range validity,
 * segment reconstruction, and cross-function consistency.
 * No I/O — safe to call from any context.
 */
export function checkFuzzySearchInvariants(): InvariantResult {
  const violations: string[] = [];

  // 1. Empty query → score 100, empty ranges
  const emptyQ = fuzzyScore("anything", "");
  if (!emptyQ) violations.push("fuzzyScore(text, '') returned null — expected {score:100, ranges:[]}");
  else {
    if (emptyQ.score !== 100) violations.push(`empty query score=${emptyQ.score}, expected 100`);
    if (emptyQ.ranges.length !== 0) violations.push("empty query returned non-empty ranges");
  }

  // 2. Score always ≤ 100 for known inputs
  const knownPairs: Array<[string, string]> = [
    ["ultron", "ul"],
    ["NOVA", "nova"],
    ["forge", "fo"],
    ["ares", "ares"],
    ["echo", "ec"],
    ["midas", "mi"],
    ["Code Foundry", "code"],
    ["signal relay", "sig"],
    ["a", "a"],
    ["ab", "ab"],
  ];
  for (const [text, query] of knownPairs) {
    const r = fuzzyScore(text, query);
    if (r === null) {
      violations.push(`fuzzyScore("${text}", "${query}") returned null unexpectedly`);
    } else {
      if (r.score < 0 || r.score > 100) {
        violations.push(`fuzzyScore("${text}", "${query}").score=${r.score} outside [0,100]`);
      }
      // 3. Ranges are valid indices
      for (const idx of r.ranges) {
        if (idx < 0 || idx >= text.length) {
          violations.push(`range idx=${idx} out of bounds for text="${text}" (len=${text.length})`);
        }
      }
      // 4. Ranges length === query length
      if (r.ranges.length !== query.length) {
        violations.push(
          `fuzzyScore("${text}", "${query}").ranges.length=${r.ranges.length}, expected ${query.length}`,
        );
      }
    }
  }

  // 5. Non-match should return null (query chars not in text)
  const noMatchPairs: Array<[string, string]> = [
    ["nova", "xyz"],
    ["forge", "fz"],
    ["echo", "zzz"],
  ];
  for (const [text, query] of noMatchPairs) {
    if (fuzzyScore(text, query) !== null) {
      violations.push(`fuzzyScore("${text}", "${query}") should return null (chars not present)`);
    }
  }

  // 6. fuzzyFilter returns all items with score=0 for whitespace query
  const agents = [
    { id: "ultron", name: "ULTRON" },
    { id: "nova", name: "NOVA" },
    { id: "forge", name: "FORGE" },
  ];
  const allEmpty = fuzzyFilter(agents, "  ", (a) => [a.name]);
  if (allEmpty.length !== agents.length) {
    violations.push(`fuzzyFilter with whitespace query returned ${allEmpty.length} items, expected ${agents.length}`);
  }
  for (const r of allEmpty) {
    if (r.score !== 0) violations.push(`whitespace query result score=${r.score}, expected 0`);
  }

  // 7. fuzzyFilter result sorted descending
  const filtered = fuzzyFilter(agents, "no", (a) => [a.name]);
  for (let i = 1; i < filtered.length; i++) {
    if (filtered[i].score > filtered[i - 1].score) {
      violations.push("fuzzyFilter results not sorted by score descending");
    }
  }

  // 8. buildHighlightSegments: reconstruction invariant
  const segCases: Array<[string, number[]]> = [
    ["ultron", [0, 3]],
    ["nova", [0]],
    ["FORGE", [0, 1, 2, 3, 4]],
    ["midas", []],
    ["ab", [0, 1]],
  ];
  for (const [text, ranges] of segCases) {
    const segs = buildHighlightSegments(text, ranges);
    const rebuilt = segs.map((s) => s.text).join("");
    if (rebuilt !== text) {
      violations.push(`buildHighlightSegments("${text}", [${ranges}]) rebuilt="${rebuilt}" != original`);
    }
    // Adjacent segments must alternate highlight
    for (let i = 1; i < segs.length; i++) {
      if (segs[i].highlight === segs[i - 1].highlight) {
        violations.push(
          `buildHighlightSegments("${text}") segs[${i}].highlight === segs[${i - 1}].highlight (no alternation)`,
        );
      }
    }
    // Every segment non-empty
    for (const seg of segs) {
      if (seg.text.length === 0) {
        violations.push(`buildHighlightSegments("${text}") produced empty segment`);
      }
    }
  }

  // 9. Cross: fuzzyScore and fuzzyFilter agree on single-item arrays
  for (const [text, query] of knownPairs) {
    const item = { name: text };
    const scoreRes = fuzzyScore(text, query);
    const filterRes = fuzzyFilter([item], query, (i) => [i.name]);
    if (scoreRes === null) {
      if (filterRes.length !== 0) {
        violations.push(`cross-check: fuzzyScore returned null but fuzzyFilter returned result for ("${text}", "${query}")`);
      }
    } else {
      if (filterRes.length !== 1) {
        violations.push(`cross-check: fuzzyScore returned match but fuzzyFilter returned 0 results for ("${text}", "${query}")`);
      } else if (filterRes[0].score !== scoreRes.score) {
        violations.push(
          `cross-check: fuzzyScore.score=${scoreRes.score} != fuzzyFilter.score=${filterRes[0].score} for ("${text}", "${query}")`,
        );
      }
    }
  }

  return {
    name: "fuzzySearch-invariants",
    ok: violations.length === 0,
    violations,
  };
}

// ─── Aggregate selftest runner ────────────────────────────────────────────────

import { AGENT_IDS } from "@/lib/conductor";

export type SelftestReport = {
  ts: string;
  allOk: boolean;
  results: InvariantResult[];
};

/**
 * Run all registered invariant checkers and return an aggregate report.
 * Safe to call server-side or in tests — no I/O, no side effects.
 */
export function runSelftest(): SelftestReport {
  const results: InvariantResult[] = [
    checkRankInvariants(),
    checkActivityStoreInvariants([...AGENT_IDS]),
    checkFuzzySearchInvariants(),
  ];

  return {
    ts: new Date().toISOString(),
    allOk: results.every((r) => r.ok),
    results,
  };
}
