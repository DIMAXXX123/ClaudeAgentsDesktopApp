import { NextRequest } from "next/server";
import {
  aggregateRetro,
  appendJournal,
  readGate,
  readPlan,
  readScoutFeed,
  writePlan,
} from "@/lib/conductorFs";
import { applyReplan, replanNextSlot } from "@/lib/conductorReplan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const slotParam = url.searchParams.get("slot");
  const plan = await readPlan();
  if (!plan) return Response.json({ status: "no-plan" }, { status: 404 });

  const slot = slotParam ? parseInt(slotParam, 10) : plan.currentSlot;
  if (!isFinite(slot)) return Response.json({ status: "bad-slot" }, { status: 400 });

  const retro = await aggregateRetro(slot);
  const gate = (await readGate(slot)) ?? {
    ts: new Date().toISOString(),
    slot,
    tscClean: true,
    testsPass: true,
    tscOutputTail: "",
    vitestOutputTail: "",
    devServerAlive: true,
    overall: "green" as const,
  };
  const scoutFeed = await readScoutFeed(undefined, 60);

  const out = await replanNextSlot({
    plan,
    retro,
    scoutFeed,
    gateOverall: gate.overall,
    redStreak: plan.redStreak,
  });

  const updated = applyReplan(plan, out, scoutFeed);
  await writePlan(updated);
  await appendJournal(`replan slot=${out.nextSlot} mode=${out.mode} notes="${out.notes.slice(0, 80)}"`);

  return Response.json({
    status: "ok",
    nextSlot: out.nextSlot,
    mode: out.mode,
    notes: out.notes,
    titles: out.updatedTitles,
  });
}
