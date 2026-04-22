import { execSync } from "node:child_process";
import path from "node:path";
import type { GateVerdict } from "./conductor";
import { DEFAULTS } from "./conductor";
import { resolveProjectRoot } from "./conductorFs";

function safeRun(cmd: string, timeoutMs: number): string {
  try {
    return execSync(cmd, {
      cwd: resolveProjectRoot(),
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 8 * 1024 * 1024,
    }).toString();
  } catch (e) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return String(err.stdout ?? "") + "\n" + String(err.stderr ?? "") + "\n" + String(err.message ?? "");
  }
}

export function parseTsc(output: string): { clean: boolean; errorCount: number } {
  const found = output.match(/Found\s+(\d+)\s+error/i);
  if (found) {
    const n = parseInt(found[1], 10);
    return { clean: n === 0, errorCount: n };
  }
  // treat empty output as clean
  if (output.trim().length === 0) return { clean: true, errorCount: 0 };
  // heuristic: count "error TS" occurrences
  const matches = output.match(/error\s+TS\d+/gi);
  const n = matches ? matches.length : 0;
  return { clean: n === 0, errorCount: n };
}

export function parseVitest(output: string): { pass: boolean; failed: number; passed: number } {
  const failedMatch = output.match(/Tests\s+(\d+)\s+failed/i);
  const passedMatch = output.match(/Tests?\s+(\d+)\s+passed/i);
  const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
  const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
  const anyFail = failed > 0 || /FAIL\s/.test(output);
  return { pass: !anyFail && (passed > 0 || output.includes("no test files")), failed, passed };
}

export async function checkDevServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 3000);
    const r = await fetch("http://localhost:3000/", { signal: controller.signal });
    clearTimeout(t);
    return r.ok || r.status < 500;
  } catch {
    return false;
  }
}

export async function runGate(slot: number): Promise<GateVerdict> {
  void path;
  const tscOut = safeRun("npx tsc --noEmit --incremental", Math.floor(DEFAULTS.GATE_TIMEOUT_MS * 0.55));
  const tsc = parseTsc(tscOut);
  const testOut = safeRun("npx vitest run --reporter=dot", Math.floor(DEFAULTS.GATE_TIMEOUT_MS * 0.45));
  const vitest = parseVitest(testOut);
  const devOk = await checkDevServer();

  const overall: "green" | "red" = tsc.clean && vitest.pass ? "green" : "red";

  return {
    ts: new Date().toISOString(),
    slot,
    tscClean: tsc.clean,
    tscOutputTail: tscOut.slice(-2000),
    testsPass: vitest.pass,
    vitestOutputTail: testOut.slice(-2000),
    devServerAlive: devOk,
    overall,
  };
}
