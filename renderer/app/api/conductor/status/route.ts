import fsp from "node:fs/promises";
import {
  abortFlagPath,
  heartbeatPath,
  journalPath,
  lockPath,
  readPlan,
  readScoutFeed,
  scoutPidPath,
} from "@/lib/conductorFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function fileJson<T>(p: string): Promise<T | null> {
  try {
    return JSON.parse(await fsp.readFile(p, "utf8")) as T;
  } catch {
    return null;
  }
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function tailJournal(maxLines = 12): Promise<string[]> {
  try {
    const raw = await fsp.readFile(journalPath(), "utf8");
    return raw.trim().split(/\n/).slice(-maxLines);
  } catch {
    return [];
  }
}

export async function GET() {
  const plan = await readPlan();
  if (!plan) {
    return Response.json({ status: "none", active: false });
  }
  const heartbeat = await fileJson<{ ts: number; slot: number; phase: string; pid: number }>(heartbeatPath());
  const lock = await fileJson<{ pid: number; startedAt: number; slot: number }>(lockPath());
  const aborted = await fileExists(abortFlagPath());
  const scoutPidRaw = await (async () => {
    try {
      return (await fsp.readFile(scoutPidPath(), "utf8")).trim();
    } catch {
      return null;
    }
  })();
  const scoutPid = scoutPidRaw ? parseInt(scoutPidRaw, 10) : null;
  const journalTail = await tailJournal();
  const scoutFeed = (await readScoutFeed(undefined, 30)).slice(-20);

  const summary = {
    slotCount: plan.slotCount,
    currentSlot: plan.currentSlot,
    degraded: plan.degraded,
    redStreak: plan.redStreak,
    scoutActive: plan.scoutActive,
    greenSlots: plan.slots.filter((s) => s.gate?.overall === "green").length,
    redSlots: plan.slots.filter((s) => s.gate?.overall === "red").length,
    pendingSlots: plan.slots.filter((s) => s.status === "pending").length,
  };

  return Response.json({
    status: "ok",
    active: !aborted && plan.currentSlot < plan.slotCount,
    aborted,
    plan: {
      createdAt: plan.createdAt,
      vision: plan.vision,
      slotCount: plan.slotCount,
      currentSlot: plan.currentSlot,
      degraded: plan.degraded,
      redStreak: plan.redStreak,
      slots: plan.slots.map((s) => ({
        index: s.index,
        mode: s.mode,
        status: s.status,
        gate: s.gate?.overall,
        titles: Object.fromEntries(
          Object.entries(s.briefs).map(([k, v]) => [k, v?.title ?? null]),
        ),
      })),
      revisionLog: plan.revisionLog.slice(-10),
      visionLog: plan.visionLog.slice(-5),
    },
    heartbeat,
    lock,
    scoutPid,
    scoutFeed,
    journalTail,
    summary,
  });
}
