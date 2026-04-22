"use client";

import { useEffect, useRef } from "react";
import { notify } from "@/lib/notify";
import { setAutofixState, getAutofixState } from "@/lib/autofixStore";

const HOUR_MS = 60 * 60 * 1000;
const BUG_POLL_MS = 30 * 1000;

type AutofixResponse =
  | { status: "clean"; signals?: { bugs?: number } }
  | { status: "ran"; bugsProcessed?: number; signals?: { tsClean?: boolean; testsPass?: boolean } }
  | { status: "error"; message?: string };

async function isConductorActive(): Promise<boolean> {
  try {
    const r = await fetch("/api/conductor/status", { cache: "no-store" });
    const d = (await r.json()) as { active?: boolean; heartbeat?: { ts: number } | null };
    if (d.active) return true;
    if (d.heartbeat && Date.now() - d.heartbeat.ts < 31 * 60 * 1000) return true;
    return false;
  } catch {
    return false;
  }
}

async function runAutofix() {
  if (await isConductorActive()) {
    notify("AUTOFIX skipped", "conductor active — yielding tsc/vitest", "info");
    return;
  }
  setAutofixState({ running: true });
  notify("AUTOFIX started", "running tsc + vitest, dispatching ARES", "info");
  try {
    const res = await fetch("/api/autofix", { method: "POST" });
    const data = (await res.json()) as AutofixResponse;
    const now = Date.now();

    if (data.status === "clean") {
      setAutofixState({
        running: false,
        lastRunAt: now,
        lastStatus: "clean",
        bugsProcessed: 0,
      });
      notify("AUTOFIX clean", "no bugs, tsc + tests green", "success");
    } else if (data.status === "ran") {
      setAutofixState({
        running: false,
        lastRunAt: now,
        lastStatus: "ran",
        bugsProcessed: data.bugsProcessed ?? 0,
      });
      notify(`AUTOFIX ran`, `processed ${data.bugsProcessed ?? 0} bugs`, "success");
    } else {
      setAutofixState({ running: false, lastRunAt: now, lastStatus: "error" });
      notify("AUTOFIX error", data.message ?? "unknown", "error");
    }
  } catch (e) {
    setAutofixState({ running: false, lastStatus: "error" });
    notify("AUTOFIX failed", (e as Error).message, "error");
  }
}

async function pollBugs() {
  try {
    const res = await fetch("/api/bugs");
    const data = (await res.json()) as { unfixed?: number };
    const prev = getAutofixState().unfixed;
    const next = data.unfixed ?? 0;
    setAutofixState({ unfixed: next });
    if (next > prev) {
      notify(`+${next - prev} bug${next - prev === 1 ? "" : "s"} captured`, `${next} unfixed total`, "warn");
    }
  } catch {
    // ignore
  }
}

export function useAutofixLoop() {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    pollBugs();
    const bugTimer = setInterval(pollBugs, BUG_POLL_MS);
    const autofixTimer = setInterval(runAutofix, HOUR_MS);

    return () => {
      clearInterval(bugTimer);
      clearInterval(autofixTimer);
    };
  }, []);
}

export function triggerAutofixNow() {
  return runAutofix();
}
