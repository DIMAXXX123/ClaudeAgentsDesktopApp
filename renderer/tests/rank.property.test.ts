/**
 * Property-based tests for lib/rank.ts pure functions.
 * Uses fast-check to verify algebraic invariants that hold for all inputs.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  levelFromCounters,
  xpValue,
  xpForLevel,
  rankFromLevel,
  nextRank,
  progressInLevel,
  unlockedMilestones,
  RANKS,
  MILESTONES,
} from "@/lib/rank";

// ─── Arbitraries ────────────────────────────────────────────────────────────

/** Non-negative safe integer for message/tool counts */
const natArb = fc.nat({ max: 100_000 });

/** A "current level" from 0 to 30 */
const levelArb = fc.nat({ max: 30 });

// ─── levelFromCounters ───────────────────────────────────────────────────────

describe("levelFromCounters", () => {
  it("is always >= 0 for any non-negative inputs", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        expect(levelFromCounters(msgs, tools)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 2000 },
    );
  });

  it("is monotonically non-decreasing as msgs or tools increase", () => {
    fc.assert(
      fc.property(
        natArb,
        natArb,
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        (msgs, tools, dMsgs, dTools) => {
          const base = levelFromCounters(msgs, tools);
          const higher = levelFromCounters(msgs + dMsgs, tools + dTools);
          expect(higher).toBeGreaterThanOrEqual(base);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("always returns an integer", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        const lvl = levelFromCounters(msgs, tools);
        expect(Number.isInteger(lvl)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── xpValue ────────────────────────────────────────────────────────────────

describe("xpValue", () => {
  it("is always >= 0", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        expect(xpValue(msgs, tools)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 1000 },
    );
  });

  it("adding a tool is worth more than adding a message (weight 2 vs 1)", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        const withExtraTool = xpValue(msgs, tools + 1);
        const withExtraMsg = xpValue(msgs + 1, tools);
        // tool adds 2 xp, message adds 1 xp
        expect(withExtraTool - xpValue(msgs, tools)).toBe(2);
        expect(withExtraMsg - xpValue(msgs, tools)).toBe(1);
      }),
      { numRuns: 1000 },
    );
  });

  it("is consistent with levelFromCounters: xpValue never loses info vs sqrt", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        const xp = xpValue(msgs, tools);
        // level = floor(sqrt(xp)), so xpForLevel(level) <= xp
        const level = levelFromCounters(msgs, tools);
        expect(xpForLevel(level)).toBeLessThanOrEqual(xp);
      }),
      { numRuns: 1000 },
    );
  });
});

// ─── xpForLevel ─────────────────────────────────────────────────────────────

describe("xpForLevel", () => {
  it("is strictly increasing", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        expect(xpForLevel(level + 1)).toBeGreaterThan(xpForLevel(level));
      }),
      { numRuns: 500 },
    );
  });

  it("level 0 requires 0 xp", () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it("always returns non-negative values", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        expect(xpForLevel(level)).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── rankFromLevel ───────────────────────────────────────────────────────────

describe("rankFromLevel", () => {
  it("always returns a rank from the RANKS array", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const rank = rankFromLevel(level);
        const keys = RANKS.map((r) => r.key);
        expect(keys).toContain(rank.key);
      }),
      { numRuns: 500 },
    );
  });

  it("rank.minLevel is always <= level", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const rank = rankFromLevel(level);
        expect(rank.minLevel).toBeLessThanOrEqual(level);
      }),
      { numRuns: 500 },
    );
  });

  it("rank progression is non-decreasing with level", () => {
    // If levelA < levelB then rankFromLevel(levelA).minLevel <= rankFromLevel(levelB).minLevel
    fc.assert(
      fc.property(
        fc.nat({ max: 14 }),
        fc.nat({ max: 14 }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const rankLo = rankFromLevel(lo);
          const rankHi = rankFromLevel(hi);
          expect(rankLo.minLevel).toBeLessThanOrEqual(rankHi.minLevel);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("all ranks have non-empty label and color strings", () => {
    for (const r of RANKS) {
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.color.length).toBeGreaterThan(0);
    }
  });
});

// ─── nextRank ────────────────────────────────────────────────────────────────

describe("nextRank", () => {
  it("returns null at or above max rank level", () => {
    const maxMinLevel = Math.max(...RANKS.map((r) => r.minLevel));
    // Any level >= maxMinLevel should return null eventually (at high enough level)
    const result = nextRank(maxMinLevel + 100);
    expect(result).toBeNull();
  });

  it("when not null, nextRank.minLevel is always > current level", () => {
    fc.assert(
      fc.property(fc.nat({ max: 12 }), (level) => {
        const next = nextRank(level);
        if (next !== null) {
          expect(next.minLevel).toBeGreaterThan(level);
        }
      }),
      { numRuns: 300 },
    );
  });

  it("nextRank key exists in RANKS", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const next = nextRank(level);
        if (next !== null) {
          expect(RANKS.map((r) => r.key)).toContain(next.key);
        }
      }),
      { numRuns: 300 },
    );
  });
});

// ─── progressInLevel ────────────────────────────────────────────────────────

describe("progressInLevel", () => {
  it("always returns a value in [0, 1]", () => {
    fc.assert(
      fc.property(natArb, levelArb, (xp, level) => {
        const p = progressInLevel(xp, level);
        expect(p).toBeGreaterThanOrEqual(0);
        expect(p).toBeLessThanOrEqual(1);
      }),
      { numRuns: 2000 },
    );
  });

  it("at exactly xpForLevel(level) progress is 0", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const xp = xpForLevel(level);
        const p = progressInLevel(xp, level);
        expect(p).toBeCloseTo(0, 5);
      }),
      { numRuns: 100 },
    );
  });

  it("at xpForLevel(level+1) progress is 1", () => {
    fc.assert(
      fc.property(levelArb, (level) => {
        const xp = xpForLevel(level + 1);
        const p = progressInLevel(xp, level);
        expect(p).toBeCloseTo(1, 5);
      }),
      { numRuns: 100 },
    );
  });

  it("is monotonically non-decreasing as xp increases (same level)", () => {
    fc.assert(
      fc.property(
        levelArb,
        fc.nat({ max: 500 }),
        fc.nat({ max: 500 }),
        (level, xpA, xpB) => {
          const lo = Math.min(xpA, xpB);
          const hi = Math.max(xpA, xpB);
          const pLo = progressInLevel(lo, level);
          const pHi = progressInLevel(hi, level);
          expect(pHi).toBeGreaterThanOrEqual(pLo - 1e-10);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

// ─── unlockedMilestones ──────────────────────────────────────────────────────

describe("unlockedMilestones", () => {
  it("always returns a subset of MILESTONES", () => {
    fc.assert(
      fc.property(natArb, (msgs) => {
        const unlocked = unlockedMilestones(msgs);
        for (const m of unlocked) {
          expect(MILESTONES).toContainEqual(m);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("is monotonically non-decreasing: more messages → same or more milestones", () => {
    fc.assert(
      fc.property(natArb, fc.nat({ max: 100 }), (msgs, delta) => {
        const before = unlockedMilestones(msgs).length;
        const after = unlockedMilestones(msgs + delta).length;
        expect(after).toBeGreaterThanOrEqual(before);
      }),
      { numRuns: 1000 },
    );
  });

  it("result is always sorted by .at ascending", () => {
    fc.assert(
      fc.property(natArb, (msgs) => {
        const unlocked = unlockedMilestones(msgs);
        for (let i = 1; i < unlocked.length; i++) {
          expect(unlocked[i].at).toBeGreaterThanOrEqual(unlocked[i - 1].at);
        }
      }),
      { numRuns: 500 },
    );
  });

  it("at 0 messages returns no milestones", () => {
    expect(unlockedMilestones(0)).toHaveLength(0);
  });

  it("each milestone label is a non-empty string", () => {
    for (const m of MILESTONES) {
      expect(typeof m.label).toBe("string");
      expect(m.label.length).toBeGreaterThan(0);
    }
  });
});

// ─── Cross-function invariants ───────────────────────────────────────────────

describe("rank system — cross-function invariants", () => {
  it("RANKS are ordered by minLevel ascending", () => {
    for (let i = 1; i < RANKS.length; i++) {
      expect(RANKS[i].minLevel).toBeGreaterThan(RANKS[i - 1].minLevel);
    }
  });

  it("levelFromCounters and rankFromLevel agree: rank never skips", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        const level = levelFromCounters(msgs, tools);
        const rank = rankFromLevel(level);
        // Rank must be reachable from level
        expect(rank.minLevel).toBeLessThanOrEqual(level);
        // next rank (if any) must require a strictly higher level
        const next = nextRank(level);
        if (next) {
          expect(next.minLevel).toBeGreaterThan(level);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it("xp algebra: xp(msgs,tools) == msgs + tools*2 (definition check)", () => {
    fc.assert(
      fc.property(natArb, natArb, (msgs, tools) => {
        expect(xpValue(msgs, tools)).toBe(msgs + tools * 2);
      }),
      { numRuns: 1000 },
    );
  });
});
