import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentId, Plan, Slot, SlotMode } from "./conductor";
import { AGENT_IDS, PILLARS } from "./conductor";
import type { SlotRetro, ScoutIdea } from "./conductor";
import { buildAllBriefs, hasNoDuplicates } from "./conductorBriefs";
import { resolveProjectRoot } from "./conductorFs";

export type ReplanInput = {
  plan: Plan;
  retro: SlotRetro;
  scoutFeed: ScoutIdea[];
  gateOverall: "green" | "red";
  redStreak: number;
};

export type ReplanOutput = {
  nextSlot: number;
  mode: SlotMode;
  notes: string;
  updatedTitles: Partial<Record<AgentId, string>>;
};

function buildReplanPrompt(input: ReplanInput): string {
  const { plan, retro, scoutFeed, gateOverall, redStreak } = input;
  const nextSlotIndex = retro.slot + 1;

  const retroSummary = AGENT_IDS.map((id) => {
    const e = retro.entries[id];
    if (!e) return `- ${id}: (no retro)`;
    return `- ${id}: ${e.summary.slice(0, 160)} | files=${e.filesTouched.length} | blockers=${e.blockers.length} | conf=${e.confidence.toFixed(2)}`;
  }).join("\n");

  const topIdeas = scoutFeed
    .slice(-30)
    .sort((a, b) => b.rank - a.rank)
    .slice(0, 12)
    .map((i) => `- [${i.pillar}:${i.rank}] ${i.idea}${i.sourceUrl ? " — " + i.sourceUrl : ""}`)
    .join("\n");

  const modeHint =
    gateOverall === "red" && redStreak >= 2
      ? "STABILIZATION (next slot must stabilize — fix tsc/vitest)"
      : gateOverall === "red"
        ? "EXTEND-or-POLISH (one agent may need to fix, others extend)"
        : "EXTEND (70%) or POLISH (30%) based on retro confidence";

  return `
You are CONDUCTOR, re-planning slot ${nextSlotIndex} of ${plan.slotCount} in the ULTRONOS overnight orchestrator.

Vision: ${plan.vision}

Last slot ${retro.slot} retro:
${retroSummary}
Gate overall: ${gateOverall} | red streak: ${redStreak}

Top SCOUT ideas (last ~30 entries):
${topIdeas || "(no scout ideas yet)"}

Your job: produce JSON with UPDATED TITLES per agent for the next slot. NO prose, ONLY valid JSON.
Constraints:
- 6 agents: ${AGENT_IDS.join(", ")}. Each must get a unique task title.
- Owned paths (exclusive write):
${AGENT_IDS.map((id) => `  ${id}: ${PILLARS[id].ownedPaths.join(", ")}`).join("\n")}
- If mode is STABILIZATION, all agents focus on fixing tsc+vitest problems inside their owned paths.
- Titles must be concrete, distinct, advance the vision. 8-16 words each.
- If a SCOUT idea fits a pillar, weave it in.
- Never touch protected paths (lib/agents.ts, app/api/chat/**, .env, etc).

Recommended mode for next slot: ${modeHint}

Output schema EXACTLY:
{
  "mode": "extend" | "polish" | "stabilization",
  "notes": "1-2 sentences what you adapted based on retro+scout",
  "updatedTitles": {
    "ultron": "...",
    "nova": "...",
    "forge": "...",
    "ares": "...",
    "echo": "...",
    "midas": "..."
  }
}
`.trim();
}

export async function replanNextSlot(
  input: ReplanInput,
  opts: { model?: "sonnet" | "haiku" | "opus" } = {},
): Promise<ReplanOutput> {
  const prompt = buildReplanPrompt(input);
  const model = opts.model ?? "sonnet";

  let buf = "";
  try {
    const q = query({
      prompt,
      options: {
        cwd: resolveProjectRoot(),
        model: model === "sonnet" ? "claude-sonnet-4-6" : model === "haiku" ? "claude-haiku-4-5-20251001" : "claude-opus-4-7",
        allowedTools: [],
        permissionMode: "bypassPermissions",
        maxTurns: 1,
      },
    });

    for await (const message of q) {
      const m = message as {
        type: string;
        message?: { content?: Array<{ type: string; text?: string }> };
        result?: string;
      };
      if (m.type === "assistant" && m.message?.content) {
        for (const c of m.message.content) {
          if (c.type === "text" && c.text) buf += c.text;
        }
      }
      if (m.type === "result" && m.result) buf = m.result;
    }
  } catch (e) {
    return fallback(input, `replan error: ${(e as Error).message}`);
  }

  const parsed = parseReplanJson(buf);
  if (!parsed) return fallback(input, "replan returned non-JSON");

  const allTitlesPresent = AGENT_IDS.every((id) => typeof parsed.updatedTitles[id] === "string" && parsed.updatedTitles[id]!.trim().length > 4);
  if (!allTitlesPresent) return fallback(input, "replan missing titles");

  return {
    nextSlot: input.retro.slot + 1,
    mode: parsed.mode,
    notes: parsed.notes ?? "",
    updatedTitles: parsed.updatedTitles,
  };
}

function parseReplanJson(raw: string): { mode: SlotMode; notes: string; updatedTitles: Partial<Record<AgentId, string>> } | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(raw.slice(start, end + 1)) as {
      mode?: string;
      notes?: string;
      updatedTitles?: Record<string, string>;
    };
    const mode: SlotMode = obj.mode === "polish" || obj.mode === "stabilization" ? obj.mode : "extend";
    return {
      mode,
      notes: obj.notes ?? "",
      updatedTitles: (obj.updatedTitles ?? {}) as Partial<Record<AgentId, string>>,
    };
  } catch {
    return null;
  }
}

function fallback(input: ReplanInput, reason: string): ReplanOutput {
  const mode: SlotMode = input.redStreak >= 2 ? "stabilization" : "extend";
  const updated: Partial<Record<AgentId, string>> = {};
  for (const id of AGENT_IDS) {
    const seeds = input.plan.skeleton[id].seeds;
    updated[id] = seeds[(input.retro.slot + 1) % seeds.length];
  }
  return {
    nextSlot: input.retro.slot + 1,
    mode,
    notes: `fallback: ${reason}`,
    updatedTitles: updated,
  };
}

/**
 * Apply re-plan to plan.json: update the titles in the next slot, ensuring skeleton fallback if slot missing.
 */
export function applyReplan(plan: Plan, out: ReplanOutput, scoutFeed: ScoutIdea[]): Plan {
  const nextIdx = out.nextSlot;
  if (nextIdx >= plan.slotCount) return plan;

  // Ensure slot exists
  let slot = plan.slots[nextIdx];
  if (!slot) {
    slot = {
      index: nextIdx,
      startsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      mode: out.mode,
      briefs: { ultron: null, nova: null, forge: null, ares: null, echo: null, midas: null },
      status: "pending",
    };
    plan.slots[nextIdx] = slot;
  } else {
    slot.mode = out.mode;
  }

  // Replace seeds at index so buildAllBriefs picks updated titles next
  for (const id of AGENT_IDS) {
    const title = out.updatedTitles[id];
    if (title) {
      const seeds = plan.skeleton[id].seeds;
      seeds[nextIdx % seeds.length] = title;
    }
  }

  // Build briefs up front so tick can just read them
  slot.briefs = buildAllBriefs(plan, nextIdx, out.mode, scoutFeed, AGENT_IDS);
  if (!hasNoDuplicates(slot.briefs)) {
    // nudge distinctness: suffix index per agent
    for (const id of AGENT_IDS) {
      const b = slot.briefs[id];
      if (b) b.title = `${b.title} [${id.toUpperCase()} #${nextIdx}]`;
    }
  }

  plan.revisionLog.push({
    ts: new Date().toISOString(),
    slot: nextIdx,
    by: "replan",
    note: out.notes.slice(0, 200),
  });
  return plan;
}

export { applyReplan as _applyReplan };
export type { Slot };
