import { describe, it, expect } from "vitest";
import {
  AGENT_IDS,
  DEFAULTS,
  PILLARS,
  PROTECTED_PATHS,
  WAVES,
} from "@/lib/conductor";
import { parseTsc, parseVitest } from "@/lib/conductorGate";
import { buildAllBriefs, hasNoDuplicates } from "@/lib/conductorBriefs";
import type { Plan, AgentId } from "@/lib/conductor";

function mkPlan(): Plan {
  const seeds: Record<AgentId, string[]> = {
    ultron: ["U1", "U2", "U3"],
    nova: ["N1", "N2", "N3"],
    forge: ["F1", "F2", "F3"],
    ares: ["A1", "A2", "A3"],
    echo: ["E1", "E2", "E3"],
    midas: ["M1", "M2", "M3"],
  };
  return {
    createdAt: new Date().toISOString(),
    projectRoot: "/test",
    vision: "test vision",
    visionLog: [],
    skeleton: Object.fromEntries(
      AGENT_IDS.map((id) => [id, { title: PILLARS[id].name, seeds: seeds[id] }]),
    ) as Plan["skeleton"],
    slotCount: 3,
    currentSlot: 0,
    slots: [],
    degraded: false,
    redStreak: 0,
    revisionLog: [],
    scoutActive: false,
    aborted: false,
  };
}

describe("conductor types & constants", () => {
  it("has 6 agents", () => {
    expect(AGENT_IDS).toHaveLength(6);
  });

  it("has 3 waves of 2 agents covering all 6", () => {
    const flat = WAVES.flat();
    expect(flat).toHaveLength(6);
    expect(new Set(flat).size).toBe(6);
  });

  it("every pillar has owned paths", () => {
    for (const id of AGENT_IDS) {
      expect(PILLARS[id].ownedPaths.length).toBeGreaterThan(0);
    }
  });

  it("PROTECTED_PATHS includes lib/agents.ts and .env", () => {
    expect(PROTECTED_PATHS).toContain("lib/agents.ts");
    expect(PROTECTED_PATHS.some((p) => p.startsWith(".env"))).toBe(true);
  });
});

describe("gate parser", () => {
  it("parseTsc detects Found 0 errors as clean", () => {
    expect(parseTsc("Found 0 errors.")).toEqual({ clean: true, errorCount: 0 });
  });

  it("parseTsc counts errors from 'Found N errors'", () => {
    expect(parseTsc("Some output\nFound 5 errors in 3 files.")).toEqual({
      clean: false,
      errorCount: 5,
    });
  });

  it("parseTsc treats empty as clean", () => {
    expect(parseTsc("   ")).toEqual({ clean: true, errorCount: 0 });
  });

  it("parseVitest detects passing", () => {
    const out = "Tests  8 passed (8)\nDuration  1.2s";
    const r = parseVitest(out);
    expect(r.pass).toBe(true);
    expect(r.failed).toBe(0);
  });

  it("parseVitest detects failing", () => {
    const out = "Tests  2 failed | 6 passed (8)";
    const r = parseVitest(out);
    expect(r.pass).toBe(false);
    expect(r.failed).toBe(2);
  });
});

describe("briefs", () => {
  it("buildAllBriefs produces 6 distinct titles", () => {
    const plan = mkPlan();
    const briefs = buildAllBriefs(plan, 0, "extend", [], AGENT_IDS);
    expect(hasNoDuplicates(briefs)).toBe(true);
    const titles = Object.values(briefs).map((b) => b?.title);
    expect(new Set(titles).size).toBe(6);
  });

  it("briefs reference owned paths", () => {
    const plan = mkPlan();
    const briefs = buildAllBriefs(plan, 1, "extend", [], AGENT_IDS);
    const ultronBrief = briefs.ultron!;
    expect(ultronBrief.instructions).toContain("app/api/bridge");
    expect(ultronBrief.instructions).toContain("BLOCKED");
  });

  it("stabilization mode included in instructions", () => {
    const plan = mkPlan();
    const briefs = buildAllBriefs(plan, 2, "stabilization", [], AGENT_IDS);
    expect(briefs.ares!.instructions).toContain("STABILIZATION");
  });
});

describe("defaults", () => {
  it("slot timing sane", () => {
    expect(DEFAULTS.SLOT_MS).toBe(30 * 60 * 1000);
    expect(DEFAULTS.AGENT_TIMEOUT_MS).toBeLessThan(DEFAULTS.SLOT_MS);
    expect(DEFAULTS.GATE_TIMEOUT_MS).toBeLessThan(DEFAULTS.SLOT_MS);
  });

  it("heartbeat stale threshold > slot", () => {
    expect(DEFAULTS.HEARTBEAT_STALE_MS).toBeGreaterThan(DEFAULTS.SLOT_MS);
  });
});
