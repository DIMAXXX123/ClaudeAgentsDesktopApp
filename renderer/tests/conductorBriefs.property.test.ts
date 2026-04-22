/**
 * Property-based tests for lib/conductorBriefs.ts
 * Verifies hasNoDuplicates, buildBrief, buildAllBriefs invariants
 * using fast-check exhaustive strategies.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { buildBrief, buildAllBriefs, hasNoDuplicates } from "@/lib/conductorBriefs";
import type { AgentBrief, AgentId, Plan, ScoutIdea, SlotMode } from "@/lib/conductor";
import { AGENT_IDS } from "@/lib/conductor";

// ─── Arbitraries ────────────────────────────────────────────────────────────

const agentIdArb: fc.Arbitrary<AgentId> = fc.constantFrom(...AGENT_IDS);
const slotModeArb: fc.Arbitrary<SlotMode> = fc.constantFrom("extend", "polish", "stabilization");

/** Minimal valid Plan stub (only fields used by buildBrief) */
function makePlan(seeds: Partial<Record<AgentId, string[]>> = {}): Plan {
  const skeleton = Object.fromEntries(
    AGENT_IDS.map((id) => [
      id,
      { title: `${id}-pillar`, seeds: seeds[id] ?? ["task-a", "task-b", "task-c"] },
    ]),
  ) as Record<AgentId, { title: string; seeds: string[] }>;

  return {
    createdAt: new Date().toISOString(),
    projectRoot: "/test",
    vision: "test vision",
    visionLog: [],
    skeleton,
    slotCount: 22,
    currentSlot: 0,
    slots: [],
    degraded: false,
    redStreak: 0,
    revisionLog: [],
    scoutActive: false,
    aborted: false,
  };
}

const scoutIdeaArb: fc.Arbitrary<ScoutIdea> = fc.record({
  ts: fc.constant(new Date().toISOString()),
  pillar: fc.oneof(agentIdArb, fc.constant("any" as const)),
  idea: fc.string({ minLength: 1, maxLength: 100 }),
  sourceUrl: fc.option(fc.webUrl(), { nil: undefined }),
  rank: fc.nat({ max: 10 }),
  tags: fc.array(fc.string({ maxLength: 20 }), { maxLength: 5 }),
});

const briefNullableArb = (title: string): AgentBrief => ({
  agentId: "ares",
  title,
  mode: "extend",
  instructions: "",
  scoutIdeas: [],
});

// ─── hasNoDuplicates ─────────────────────────────────────────────────────────

describe("hasNoDuplicates", () => {
  it("returns true when all titles are unique", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.string({ minLength: 1, maxLength: 50 }), {
          minLength: 0,
          maxLength: 6,
          selector: (s) => s.trim().toLowerCase(),
        }),
        (uniqueTitles) => {
          const briefs = Object.fromEntries(
            AGENT_IDS.slice(0, uniqueTitles.length).map((id, i) => [
              id,
              briefNullableArb(uniqueTitles[i]),
            ]),
          ) as Record<AgentId, AgentBrief | null>;
          // Fill remaining with null
          for (const id of AGENT_IDS) {
            if (!(id in briefs)) briefs[id] = null;
          }
          expect(hasNoDuplicates(briefs)).toBe(true);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("returns false when two non-null briefs share the same title (case-insensitive)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom(...(AGENT_IDS.slice(0, 5) as AgentId[])),
        fc.constantFrom(...(AGENT_IDS.slice(1) as AgentId[])),
        (title, idA, idB) => {
          if (idA === idB) return; // skip, same id
          const briefs: Record<AgentId, AgentBrief | null> = {
            ultron: null,
            nova: null,
            forge: null,
            ares: null,
            echo: null,
            midas: null,
          };
          briefs[idA] = briefNullableArb(title);
          briefs[idB] = briefNullableArb(title.toUpperCase()); // same title, different case
          expect(hasNoDuplicates(briefs)).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("all-null brief map has no duplicates (vacuously true)", () => {
    const allNull: Record<AgentId, AgentBrief | null> = {
      ultron: null,
      nova: null,
      forge: null,
      ares: null,
      echo: null,
      midas: null,
    };
    expect(hasNoDuplicates(allNull)).toBe(true);
  });

  it("single non-null brief has no duplicates", () => {
    fc.assert(
      fc.property(agentIdArb, fc.string({ minLength: 1, maxLength: 50 }), (id, title) => {
        const briefs: Record<AgentId, AgentBrief | null> = {
          ultron: null,
          nova: null,
          forge: null,
          ares: null,
          echo: null,
          midas: null,
        };
        briefs[id] = briefNullableArb(title);
        expect(hasNoDuplicates(briefs)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });
});

// ─── buildBrief ──────────────────────────────────────────────────────────────

describe("buildBrief", () => {
  it("never throws for any valid agentId, slot, mode, and scout ideas", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(
        agentIdArb,
        fc.nat({ max: 21 }),
        slotModeArb,
        fc.array(scoutIdeaArb, { maxLength: 10 }),
        (agentId, slot, mode, scouts) => {
          expect(() => buildBrief(plan, slot, agentId, mode, scouts)).not.toThrow();
        },
      ),
      { numRuns: 500 },
    );
  });

  it("returned brief always has a non-empty title", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(
        agentIdArb,
        fc.nat({ max: 21 }),
        slotModeArb,
        fc.array(scoutIdeaArb, { maxLength: 5 }),
        (agentId, slot, mode, scouts) => {
          const brief = buildBrief(plan, slot, agentId, mode, scouts);
          expect(brief.title.trim().length).toBeGreaterThan(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("brief.agentId matches the requested agentId", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(agentIdArb, fc.nat({ max: 21 }), slotModeArb, (agentId, slot, mode) => {
        const brief = buildBrief(plan, slot, agentId, mode, []);
        expect(brief.agentId).toBe(agentId);
      }),
      { numRuns: 500 },
    );
  });

  it("brief.mode matches the requested mode", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(agentIdArb, fc.nat({ max: 21 }), slotModeArb, (agentId, slot, mode) => {
        const brief = buildBrief(plan, slot, agentId, mode, []);
        expect(brief.mode).toBe(mode);
      }),
      { numRuns: 300 },
    );
  });

  it("instructions always contain the agentId name (uppercase)", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(agentIdArb, fc.nat({ max: 21 }), slotModeArb, (agentId, slot, mode) => {
        const brief = buildBrief(plan, slot, agentId, mode, []);
        expect(brief.instructions).toContain(agentId.toUpperCase());
      }),
      { numRuns: 300 },
    );
  });

  it("slot modulo seed length — same seed selected for slot N and N+seedLen", () => {
    fc.assert(
      fc.property(
        agentIdArb,
        fc.nat({ max: 5 }),
        fc.integer({ min: 2, max: 8 }),
        slotModeArb,
        (agentId, baseSlot, seedCount, mode) => {
          const seeds = Array.from({ length: seedCount }, (_, i) => `seed-${i}`);
          const plan = makePlan({ [agentId]: seeds });
          const brief1 = buildBrief(plan, baseSlot, agentId, mode, []);
          const brief2 = buildBrief(plan, baseSlot + seedCount, agentId, mode, []);
          expect(brief1.title).toBe(brief2.title);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("scoutIdeas in brief are always a subset of provided scouts (agentId or 'any' filter)", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(
        agentIdArb,
        fc.nat({ max: 21 }),
        slotModeArb,
        fc.array(scoutIdeaArb, { maxLength: 15 }),
        (agentId, slot, mode, scouts) => {
          const brief = buildBrief(plan, slot, agentId, mode, scouts);
          const allowed = scouts.filter((s) => s.pillar === agentId || s.pillar === "any");
          const scoutIdeas = brief.scoutIdeas ?? [];
          for (const idea of scoutIdeas) {
            expect(allowed).toContainEqual(idea);
          }
          // max 3 scout ideas returned
          expect(scoutIdeas.length).toBeLessThanOrEqual(3);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── buildAllBriefs ──────────────────────────────────────────────────────────

describe("buildAllBriefs", () => {
  it("returns entries for all 6 agent IDs (null for inactive)", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(
        fc.subarray(AGENT_IDS, { minLength: 1 }),
        fc.nat({ max: 21 }),
        slotModeArb,
        (activeAgents, slot, mode) => {
          const result = buildAllBriefs(plan, slot, mode, [], activeAgents);
          expect(Object.keys(result)).toHaveLength(AGENT_IDS.length);
          for (const id of AGENT_IDS) {
            if (activeAgents.includes(id)) {
              expect(result[id]).not.toBeNull();
            } else {
              expect(result[id]).toBeNull();
            }
          }
        },
      ),
      { numRuns: 300 },
    );
  });

  it("active agents produce briefs with the correct agentId", () => {
    const plan = makePlan();
    fc.assert(
      fc.property(
        fc.subarray(AGENT_IDS, { minLength: 1 }),
        fc.nat({ max: 21 }),
        slotModeArb,
        (activeAgents, slot, mode) => {
          const result = buildAllBriefs(plan, slot, mode, [], activeAgents);
          for (const id of activeAgents) {
            expect(result[id]?.agentId).toBe(id);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("with all 6 agents active, hasNoDuplicates holds (seeds are distinct)", () => {
    // Use unique seeds per agent to guarantee no duplicates
    const uniqueSeeds = Object.fromEntries(
      AGENT_IDS.map((id, i) => [id, [`unique-seed-${id}-${i}`]]),
    ) as Record<AgentId, string[]>;
    const plan = makePlan(uniqueSeeds);

    fc.assert(
      fc.property(fc.nat({ max: 21 }), slotModeArb, (slot, mode) => {
        const result = buildAllBriefs(plan, slot, mode, [], [...AGENT_IDS]);
        expect(hasNoDuplicates(result)).toBe(true);
      }),
      { numRuns: 200 },
    );
  });
});
