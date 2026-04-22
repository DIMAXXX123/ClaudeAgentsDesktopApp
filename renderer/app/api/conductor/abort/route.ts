import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import {
  abortFlagPath,
  appendJournal,
  releaseLock,
  scoutPidPath,
  setAborted,
} from "@/lib/conductorFs";
import { unregisterSchtasks } from "@/lib/conductorRun";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const reason = url.searchParams.get("reason") ?? "manual-abort";

  const steps: string[] = [];

  try {
    await setAborted(reason);
    steps.push(`ABORTED flag: ${abortFlagPath()}`);
  } catch (e) {
    steps.push(`setAborted failed: ${(e as Error).message}`);
  }

  try {
    unregisterSchtasks();
    steps.push("schtasks deleted");
  } catch (e) {
    steps.push(`schtasks delete failed: ${(e as Error).message}`);
  }

  try {
    const pidRaw = await fs.readFile(scoutPidPath(), "utf8").catch(() => "");
    const pid = parseInt(pidRaw.trim(), 10);
    if (pid && !Number.isNaN(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        steps.push(`SCOUT pid=${pid} SIGTERM sent`);
      } catch (e) {
        steps.push(`SCOUT kill failed: ${(e as Error).message}`);
      }
      await fs.rm(scoutPidPath(), { force: true });
    } else {
      steps.push("SCOUT pid not present");
    }
  } catch (e) {
    steps.push(`SCOUT cleanup error: ${(e as Error).message}`);
  }

  try {
    await releaseLock();
    steps.push("conductor lock released");
  } catch (e) {
    steps.push(`lock release failed: ${(e as Error).message}`);
  }

  await appendJournal(`ABORT reason="${reason}" — ${steps.join("; ")}`);

  return Response.json({ status: "aborted", reason, steps });
}
