import { NextRequest } from "next/server";
import { runSlot } from "@/lib/conductorRun";
import {
  appendJournal,
  heartbeatIsStale,
  readHeartbeat,
  readPlan,
} from "@/lib/conductorFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 1700;

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "true";
  if (dry) process.env.CONDUCTOR_DRY = "1";

  const plan = await readPlan();
  if (!plan) return Response.json({ status: "no-plan" }, { status: 404 });

  const hb = await readHeartbeat();
  if (hb && !heartbeatIsStale(hb)) {
    const age = Math.round((Date.now() - hb.ts) / 1000);
    if (age < 60) {
      await appendJournal(`tick squashed: hb fresh age=${age}s slot=${hb.slot} phase=${hb.phase}`);
      return Response.json({ status: "squashed", reason: "heartbeat fresh", hb });
    }
  } else if (hb && heartbeatIsStale(hb)) {
    await appendJournal(`tick: previous heartbeat stale (slot=${hb.slot} phase=${hb.phase}) — proceeding`);
  }

  try {
    const result = await runSlot();
    return Response.json({ status: "ok", result });
  } catch (e) {
    const msg = (e as Error).message;
    await appendJournal(`tick CRASH: ${msg.slice(0, 200)}`);
    return Response.json({ status: "error", message: msg }, { status: 500 });
  } finally {
    if (dry) delete process.env.CONDUCTOR_DRY;
  }
}
