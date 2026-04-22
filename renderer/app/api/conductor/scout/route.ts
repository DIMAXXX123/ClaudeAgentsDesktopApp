import { NextRequest } from "next/server";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import {
  appendJournal,
  ensureDirs,
  readPlan,
  resolveProjectRoot,
  scoutPidPath,
  writePlan,
} from "@/lib/conductorFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readPid(): number | null {
  try {
    const raw = fs.readFileSync(scoutPidPath(), "utf8").trim();
    const n = parseInt(raw, 10);
    return isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

async function startScout(): Promise<number> {
  await ensureDirs();
  const existing = readPid();
  if (existing && isAlive(existing)) return existing;

  const root = resolveProjectRoot();
  const workerPath = path.join(root, "lib", "scoutWorker.ts");

  // Use bun (TS-native) if available, else fall back to node --experimental-strip-types
  const bunExe = "bun";
  const logFile = path.join(root, ".overnight-plan", "scout.stdout.log");
  const out = fs.openSync(logFile, "a");
  const err = fs.openSync(logFile, "a");

  const child = spawn(bunExe, ["run", workerPath], {
    cwd: root,
    env: {
      NODE_ENV: process.env.NODE_ENV || 'production',
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || '',
      USERPROFILE: process.env.USERPROFILE || '',
      APPDATA: process.env.APPDATA || '',
      LOCALAPPDATA: process.env.LOCALAPPDATA || '',
      SystemRoot: process.env.SystemRoot || '',
      CONDUCTOR_SCOUT: "1",
    },
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
  });
  child.unref();
  // give worker a beat to write its pid
  await new Promise((r) => setTimeout(r, 800));
  const pid = readPid() ?? child.pid ?? 0;
  if (!pid) throw new Error("scout failed to start");
  return pid;
}

function stopScout(): { ok: boolean; pid: number | null } {
  const pid = readPid();
  if (!pid) return { ok: true, pid: null };
  try {
    process.kill(pid, "SIGTERM");
    // give it a moment
  } catch {
    // already dead
  }
  try {
    fs.unlinkSync(scoutPidPath());
  } catch {
    // ignore
  }
  return { ok: true, pid };
}

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "status";

  if (action === "start") {
    try {
      const pid = await startScout();
      await appendJournal(`SCOUT started pid=${pid}`);
      const plan = await readPlan();
      if (plan) {
        plan.scoutActive = true;
        await writePlan(plan);
      }
      return Response.json({ status: "started", pid });
    } catch (e) {
      return Response.json({ status: "error", message: (e as Error).message }, { status: 500 });
    }
  }

  if (action === "stop") {
    const r = stopScout();
    await appendJournal(`SCOUT stopped pid=${r.pid ?? "none"}`);
    const plan = await readPlan();
    if (plan) {
      plan.scoutActive = false;
      await writePlan(plan);
    }
    return Response.json({ status: "stopped", ...r });
  }

  const pid = readPid();
  return Response.json({
    status: "status",
    pid,
    alive: pid ? isAlive(pid) : false,
  });
}

export async function GET() {
  const pid = readPid();
  return Response.json({ pid, alive: pid ? isAlive(pid) : false });
}
