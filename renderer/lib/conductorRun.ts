import path from "node:path";
import fsp from "node:fs/promises";
import { execSync } from "node:child_process";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { AGENTS } from "./agents";
import type { AgentBrief, AgentId, GateVerdict, Plan, RetroEntry, Slot } from "./conductor";
import { AGENT_IDS, DEFAULTS, WAVES } from "./conductor";
import { buildAllBriefs, hasNoDuplicates } from "./conductorBriefs";
import {
  acquireLock,
  aggregateRetro,
  appendJournal,
  appendScoutIdea,
  createSnapshot,
  ensureDirs,
  isAborted,
  pruneOldSnapshots,
  readPlan,
  readScoutFeed,
  releaseLock,
  resolveProjectRoot,
  slotDir,
  writeGate,
  writeHeartbeat,
  writePlan,
  writeRetro,
} from "./conductorFs";
import { runGate } from "./conductorGate";
import { applyReplan, replanNextSlot } from "./conductorReplan";

function isDry(): boolean {
  return process.env.CONDUCTOR_DRY === "1";
}

export type RunSlotResult = {
  slot: number;
  status: "completed" | "skipped" | "aborted" | "blocked";
  greenAgents: number;
  redAgents: number;
  gate?: GateVerdict;
  notes: string[];
};

function buildAgentsMap() {
  const map: Record<string, { description: string; prompt: string; tools: string[] }> = {};
  for (const a of Object.values(AGENTS)) {
    map[a.id] = {
      description: a.description,
      prompt: a.systemPrompt,
      tools: a.allowedTools,
    };
  }
  return map;
}

async function runOneAgent(
  brief: AgentBrief,
  slot: number,
  agentsMap: ReturnType<typeof buildAgentsMap>,
): Promise<RetroEntry> {
  const t0 = Date.now();
  const ctrl = new AbortController();
  const killer = setTimeout(() => ctrl.abort(), DEFAULTS.AGENT_TIMEOUT_MS);

  let toolCalls = 0;
  let summary = "";

  if (isDry()) {
    // produce a fake retro file, fake one new file
    const dryDir = path.join(resolveProjectRoot(), ".overnight-plan", `dry-run-${slot}`);
    await fsp.mkdir(dryDir, { recursive: true });
    const fname = path.join(dryDir, `${brief.agentId}.txt`);
    await fsp.writeFile(fname, `dry-run by ${brief.agentId}\ntitle: ${brief.title}\n`);
    const entry: RetroEntry = {
      agentId: brief.agentId,
      filesTouched: [path.relative(resolveProjectRoot(), fname).replace(/\\/g, "/")],
      summary: `[DRY] ${brief.title}`,
      blockers: [],
      confidence: 0.9,
      toolCalls: 1,
      durationMs: Date.now() - t0,
    };
    await writeRetro(slot, brief.agentId, entry);
    clearTimeout(killer);
    return entry;
  }

  try {
    const q = query({
      prompt: brief.instructions,
      options: {
        cwd: resolveProjectRoot(),
        agent: brief.agentId,
        agents: agentsMap as never,
        allowedTools: ["Bash", "Read", "Write", "Edit", "Grep", "Glob", "WebFetch", "WebSearch"],
        permissionMode: "bypassPermissions",
        maxTurns: DEFAULTS.MAX_TURNS,
        model: "claude-sonnet-4-6",
      },
    });

    for await (const message of q) {
      if (ctrl.signal.aborted) break;
      const m = message as {
        type: string;
        message?: { content?: Array<{ type: string; text?: string; name?: string }> };
        result?: string;
      };
      if (m.type === "assistant" && m.message?.content) {
        for (const c of m.message.content) {
          if (c.type === "text" && c.text) summary += c.text;
          if (c.type === "tool_use") toolCalls += 1;
        }
      }
      if (m.type === "result" && m.result) summary = m.result;
    }
  } catch (e) {
    summary += `\n[error] ${(e as Error).message}`;
  } finally {
    clearTimeout(killer);
  }

  // Try to read the agent's own retro file (if it followed instructions)
  const dir = slotDir(slot);
  const expected = path.join(dir, `retro-${brief.agentId}.json`);
  try {
    const raw = await fsp.readFile(expected, "utf8");
    return JSON.parse(raw) as RetroEntry;
  } catch {
    // synthesize from what we observed
    const entry: RetroEntry = {
      agentId: brief.agentId,
      filesTouched: [],
      summary: summary.slice(0, 600) || "(no output)",
      blockers: summary.toLowerCase().includes("blocked") ? ["self-reported BLOCKED"] : [],
      confidence: 0.5,
      toolCalls,
      durationMs: Date.now() - t0,
    };
    await writeRetro(slot, brief.agentId, entry);
    return entry;
  }
}

async function runWave(
  wave: [AgentId, AgentId],
  briefs: Record<AgentId, AgentBrief | null>,
  slot: number,
  agentsMap: ReturnType<typeof buildAgentsMap>,
): Promise<RetroEntry[]> {
  const tasks: Promise<RetroEntry>[] = [];
  for (const id of wave) {
    const b = briefs[id];
    if (!b) continue;
    tasks.push(runOneAgent(b, slot, agentsMap));
  }
  return Promise.all(tasks);
}

async function notifyTgSilent(text: string): Promise<void> {
  const token = process.env.TG_BOT_TOKEN;
  const chat = process.env.TG_CHAT_ID;
  if (!token || !chat) return;
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const body = new URLSearchParams({
      chat_id: chat,
      disable_notification: "true",
      text,
    });
    await fetch(url, { method: "POST", body });
  } catch {
    // silent
  }
}

export async function runSlot(): Promise<RunSlotResult> {
  await ensureDirs();

  if (await isAborted()) {
    return { slot: -1, status: "aborted", greenAgents: 0, redAgents: 0, notes: ["ABORTED flag present"] };
  }

  const planInitial = await readPlan();
  if (!planInitial) {
    return { slot: -1, status: "blocked", greenAgents: 0, redAgents: 0, notes: ["no plan.json"] };
  }
  const plan: Plan = planInitial;

  const slotIdx = plan.currentSlot;
  if (slotIdx >= plan.slotCount) {
    await appendJournal(`tick rejected: all ${plan.slotCount} slots done`);
    return { slot: slotIdx, status: "skipped", greenAgents: 0, redAgents: 0, notes: ["plan complete"] };
  }

  const lock = await acquireLock(slotIdx);
  if (!lock.ok) {
    await appendJournal(`tick rejected: locked by pid=${lock.info?.pid} slot=${lock.info?.slot}`);
    return { slot: slotIdx, status: "skipped", greenAgents: 0, redAgents: 0, notes: ["lock held"] };
  }

  const notes: string[] = [];
  let greenAgents = 0;
  let redAgents = 0;
  let gate: GateVerdict | undefined;

  try {
    await writeHeartbeat(slotIdx, "snapshot");
    const pruned = await pruneOldSnapshots(slotIdx);
    if (pruned > 0) notes.push(`pruned ${pruned} old snapshots`);
    try {
      await createSnapshot(slotIdx);
      notes.push("snapshot ok");
    } catch (e) {
      notes.push(`snapshot failed: ${(e as Error).message}`);
    }

    // build briefs if missing
    const slot: Slot = plan.slots[slotIdx];
    const scoutFeed = await readScoutFeed(undefined, 60);
    const activeAgents: AgentId[] = plan.degraded ? ["ares"] : [...AGENT_IDS];
    if (!Object.values(slot.briefs).some(Boolean)) {
      slot.briefs = buildAllBriefs(plan, slotIdx, slot.mode, scoutFeed, activeAgents);
    }
    if (!hasNoDuplicates(slot.briefs)) {
      for (const id of AGENT_IDS) {
        const b = slot.briefs[id];
        if (b) b.title = `${b.title} [${id.toUpperCase()} #${slotIdx}]`;
      }
    }
    slot.status = "running";
    await writePlan(plan);

    const agentsMap = buildAgentsMap();

    for (let w = 0; w < WAVES.length; w += 1) {
      if (await isAborted()) {
        notes.push("aborted mid-slot");
        slot.status = "skipped";
        await writePlan(plan);
        await releaseLock();
        return { slot: slotIdx, status: "aborted", greenAgents, redAgents, notes };
      }
      const wave = WAVES[w];
      const filteredWave: [AgentId, AgentId] = [
        activeAgents.includes(wave[0]) ? wave[0] : wave[0],
        activeAgents.includes(wave[1]) ? wave[1] : wave[1],
      ];
      // skip non-active agents inside wave
      const skip = !activeAgents.includes(wave[0]) && !activeAgents.includes(wave[1]);
      if (skip) continue;
      await writeHeartbeat(slotIdx, `wave-${w}`);
      const results = await runWave(filteredWave, slot.briefs, slotIdx, agentsMap);
      for (const r of results) {
        if (r.blockers.length === 0) greenAgents += 1;
        else redAgents += 1;
      }
      // small breath between waves
      await new Promise((r) => setTimeout(r, 1500));
    }

    await writeHeartbeat(slotIdx, "retro");
    await aggregateRetro(slotIdx);

    await writeHeartbeat(slotIdx, "gate");
    if (isDry()) {
      gate = {
        ts: new Date().toISOString(),
        slot: slotIdx,
        tscClean: true,
        testsPass: true,
        tscOutputTail: "[DRY]",
        vitestOutputTail: "[DRY]",
        devServerAlive: true,
        overall: "green",
      };
    } else {
      gate = await runGate(slotIdx);
    }
    await writeGate(slotIdx, gate);
    slot.gate = gate;

    if (gate.overall === "red") {
      plan.redStreak += 1;
    } else {
      plan.redStreak = 0;
    }
    if (plan.redStreak > 3) plan.degraded = true;

    slot.status = "completed";

    // re-plan next slot
    if (slotIdx + 1 < plan.slotCount) {
      await writeHeartbeat(slotIdx, "replan");
      try {
        const retro = await aggregateRetro(slotIdx);
        const out = isDry()
          ? {
              nextSlot: slotIdx + 1,
              mode: gate.overall === "red" ? ("stabilization" as const) : ("extend" as const),
              notes: "[DRY] no replan",
              updatedTitles: {},
            }
          : await replanNextSlot({
              plan,
              retro,
              scoutFeed,
              gateOverall: gate.overall,
              redStreak: plan.redStreak,
            });
        applyReplan(plan, out, scoutFeed);
        notes.push(`replan slot=${out.nextSlot} mode=${out.mode}`);
      } catch (e) {
        notes.push(`replan error: ${(e as Error).message}`);
      }
    }

    plan.currentSlot = slotIdx + 1;
    await writePlan(plan);
    await appendJournal(
      `Slot ${slotIdx} | green=${greenAgents} red=${redAgents} | gate=${gate.overall}` +
        (plan.degraded ? " | DEGRADED" : "") +
        ` | next=${plan.slots[slotIdx + 1]?.mode ?? "—"}`,
    );

    // periodic silent TG progress every 4 slots
    if ((slotIdx + 1) % 4 === 0) {
      await notifyTgSilent(
        `[slot ${slotIdx + 1}/${plan.slotCount}] green=${plan.slots.filter((s) => s.gate?.overall === "green").length} red=${plan.slots.filter((s) => s.gate?.overall === "red").length} degraded=${plan.degraded ? "YES" : "no"}`,
      );
    }

    if (gate.overall === "red") {
      await notifyTgSilent(
        `⚠ RED gate slot ${slotIdx} | tscClean=${gate.tscClean} testsPass=${gate.testsPass} dev=${gate.devServerAlive}`,
      );
    }

    return { slot: slotIdx, status: "completed", greenAgents, redAgents, gate, notes };
  } finally {
    await releaseLock();
  }
}

export function unregisterSchtasks(): void {
  try {
    execSync(`schtasks /delete /tn ULTRONOS-Conductor-Tick /f`, { stdio: "ignore", timeout: 10_000 });
  } catch {
    // ignore
  }
}

export function registerSchtasks(): void {
  // /sc minute /mo 30 /du 12:00 — runs every 30 minutes for 12 hours
  const root = resolveProjectRoot();
  const ps1 = path.join(root, ".overnight-plan", "conductor-tick.ps1");
  const cmd =
    `schtasks /create /tn ULTRONOS-Conductor-Tick /sc minute /mo 30 /du 12:00 /f ` +
    `/tr "powershell.exe -ExecutionPolicy Bypass -File \\"${ps1}\\""`;
  execSync(cmd, { stdio: "ignore", timeout: 15_000 });
}
