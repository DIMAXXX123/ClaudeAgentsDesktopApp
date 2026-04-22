import { describe, it, expect } from "vitest";
import { _applyReplan } from "@/lib/conductorReplan";
import type { Plan, AgentId } from "@/lib/conductor";
import { AGENT_IDS, PILLARS } from "@/lib/conductor";

function mkPlan(): Plan {
  const seeds: Record<AgentId, string[]> = {
    ultron: Array.from({ length: 10 }, (_, i) => `U${i}`),
    nova: Array.from({ length: 10 }, (_, i) => `N${i}`),
    forge: Array.from({ length: 10 }, (_, i) => `F${i}`),
    ares: Array.from({ length: 10 }, (_, i) => `A${i}`),
    echo: Array.from({ length: 10 }, (_, i) => `E${i}`),
    midas: Array.from({ length: 10 }, (_, i) => `M${i}`),
  };
  return {
    createdAt: new Date().toISOString(),
    projectRoot: "/test",
    vision: "v",
    visionLog: [],
    skeleton: Object.fromEntries(
      AGENT_IDS.map((id) => [id, { title: PILLARS[id].name, seeds: seeds[id] }]),
    ) as Plan["skeleton"],
    slotCount: 5,
    currentSlot: 0,
    slots: Array.from({ length: 5 }, (_, i) => ({
      index: i,
      startsAt: new Date().toISOString(),
      mode: "extend" as const,
      briefs: {
        ultron: null,
        nova: null,
        forge: null,
        ares: null,
        echo: null,
        midas: null,
      },
      status: "pending" as const,
    })),
    degraded: false,
    redStreak: 0,
    revisionLog: [],
    scoutActive: false,
    aborted: false,
  };
}

describe("applyReplan", () => {
  it("writes updated titles into next slot briefs", () => {
    const plan = mkPlan();
    const out = {
      nextSlot: 2,
      mode: "extend" as const,
      notes: "test",
      updatedTitles: {
        ultron: "new ULTRON title",
        nova: "new NOVA title",
        forge: "new FORGE title",
        ares: "new ARES title",
        echo: "new ECHO title",
        midas: "new MIDAS title",
      },
    };
    const updated = _applyReplan(plan, out, []);
    expect(updated.slots[2].briefs.ultron?.title).toContain("new ULTRON title");
    expect(updated.slots[2].briefs.midas?.title).toContain("new MIDAS title");
    expect(updated.revisionLog.at(-1)?.slot).toBe(2);
  });

  it("de-duplicates by suffixing when titles collide", () => {
    const plan = mkPlan();
    const out = {
      nextSlot: 1,
      mode: "extend" as const,
      notes: "",
      updatedTitles: {
        ultron: "same",
        nova: "same",
        forge: "same",
        ares: "same",
        echo: "same",
        midas: "same",
      },
    };
    const updated = _applyReplan(plan, out, []);
    const titles = AGENT_IDS.map((id) => updated.slots[1].briefs[id]?.title);
    expect(new Set(titles).size).toBe(6);
  });
});
