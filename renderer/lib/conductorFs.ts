import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import type {
  Plan,
  SlotRetro,
  RetroEntry,
  ScoutIdea,
  GateVerdict,
  AgentId,
} from "./conductor";
import { DEFAULTS } from "./conductor";

export const OVERNIGHT_DIR_NAME = ".overnight-plan";

export function resolveProjectRoot(): string {
  return process.cwd();
}

let _planRootCache: string | null = null;

function resolvePlanRoot(): string {
  if (_planRootCache) return _planRootCache;
  const envDir = process.env.ULTRONOS_DATA_DIR;
  _planRootCache = envDir ? path.join(envDir, OVERNIGHT_DIR_NAME) : path.join(resolveProjectRoot(), OVERNIGHT_DIR_NAME);
  return _planRootCache;
}

export function overnightDir(): string {
  return resolvePlanRoot();
}

export function planPath(): string {
  return path.join(overnightDir(), "plan.json");
}

export function heartbeatPath(): string {
  return path.join(overnightDir(), "heartbeat.json");
}

export function lockPath(): string {
  return path.join(overnightDir(), "conductor.lock");
}

export function journalPath(): string {
  return path.join(overnightDir(), "journal.md");
}

export function scoutFeedPath(): string {
  return path.join(overnightDir(), "scout-feed.jsonl");
}

export function scoutPidPath(): string {
  return path.join(overnightDir(), "scout.pid");
}

export function abortFlagPath(): string {
  return path.join(overnightDir(), "ABORTED");
}

export function slotDir(slot: number): string {
  return path.join(overnightDir(), `slot-${slot}`);
}

export function snapshotsDir(): string {
  return path.join(overnightDir(), "snapshots");
}

export async function ensureDirs(): Promise<void> {
  await fsp.mkdir(overnightDir(), { recursive: true });
  await fsp.mkdir(snapshotsDir(), { recursive: true });
  await fsp.mkdir(path.join(overnightDir(), "locks"), { recursive: true });
  await fsp.mkdir(path.join(overnightDir(), "tick-logs"), { recursive: true });
}

export async function readPlan(): Promise<Plan | null> {
  try {
    const raw = await fsp.readFile(planPath(), "utf8");
    return JSON.parse(raw) as Plan;
  } catch {
    return null;
  }
}

export async function writePlan(plan: Plan): Promise<void> {
  await ensureDirs();
  const tmp = planPath() + ".tmp";
  await fsp.writeFile(tmp, JSON.stringify(plan, null, 2));
  await fsp.rename(tmp, planPath());
}

export async function appendJournal(line: string): Promise<void> {
  await ensureDirs();
  const ts = new Date().toISOString().replace("T", " ").slice(0, 19);
  await fsp.appendFile(journalPath(), `- [${ts}] ${line}\n`);
}

export async function writeHeartbeat(slot: number, phase: string): Promise<void> {
  await ensureDirs();
  await fsp.writeFile(
    heartbeatPath(),
    JSON.stringify({ ts: Date.now(), slot, phase, pid: process.pid }, null, 2),
  );
}

export async function readHeartbeat(): Promise<{ ts: number; slot: number; phase: string; pid: number } | null> {
  try {
    const raw = await fsp.readFile(heartbeatPath(), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function heartbeatIsStale(hb: { ts: number } | null, now = Date.now()): boolean {
  if (!hb) return true;
  return now - hb.ts > DEFAULTS.HEARTBEAT_STALE_MS;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export type LockInfo = { pid: number; startedAt: number; slot: number };

export async function acquireLock(slot: number): Promise<{ ok: true } | { ok: false; reason: string; info?: LockInfo }> {
  await ensureDirs();
  const lp = lockPath();
  try {
    const raw = await fsp.readFile(lp, "utf8");
    const info = JSON.parse(raw) as LockInfo;
    const age = Date.now() - info.startedAt;
    if (age < DEFAULTS.LOCK_STALE_MS && isProcessAlive(info.pid)) {
      return { ok: false, reason: "held", info };
    }
    // stale or dead → take over
  } catch {
    // no lock
  }
  const info: LockInfo = { pid: process.pid, startedAt: Date.now(), slot };
  await fsp.writeFile(lp, JSON.stringify(info));
  return { ok: true };
}

export async function releaseLock(): Promise<void> {
  try {
    await fsp.unlink(lockPath());
  } catch {
    // ignore
  }
}

export async function isAborted(): Promise<boolean> {
  try {
    await fsp.access(abortFlagPath());
    return true;
  } catch {
    return false;
  }
}

export async function setAborted(reason: string): Promise<void> {
  await ensureDirs();
  await fsp.writeFile(abortFlagPath(), `aborted: ${new Date().toISOString()}\nreason: ${reason}\n`);
}

// --- snapshots ---

const SNAPSHOT_INCLUDE = ["app", "components", "lib", "tests"] as const;

export async function createSnapshot(slot: number): Promise<string> {
  await fsp.mkdir(snapshotsDir(), { recursive: true });
  const base = path.join(snapshotsDir(), `slot-${slot}`);
  const files: { path: string; sha256: string; size: number }[] = [];

  // compute SHA256 manifest of tracked directories
  for (const dir of SNAPSHOT_INCLUDE) {
    const full = path.join(resolveProjectRoot(), dir);
    if (!fs.existsSync(full)) continue;
    await walk(full, resolveProjectRoot(), files);
  }

  const manifest = {
    slot,
    ts: Date.now(),
    projectRoot: resolveProjectRoot(),
    fileCount: files.length,
    files,
  };
  await fsp.writeFile(`${base}.manifest.json`, JSON.stringify(manifest, null, 2));

  // try tar first, else Compress-Archive
  try {
    execSync(
      `tar -cf "${base}.tar" --exclude=node_modules --exclude=.next ${SNAPSHOT_INCLUDE.join(" ")}`,
      { cwd: resolveProjectRoot(), stdio: "ignore", timeout: 120_000 },
    );
    return `${base}.tar`;
  } catch {
    // PowerShell fallback
    const paths = SNAPSHOT_INCLUDE.map((d) => `'${d}'`).join(",");
    const cmd = `powershell -NoProfile -Command "Compress-Archive -Path ${paths} -DestinationPath '${base}.zip' -Force"`;
    execSync(cmd, { cwd: resolveProjectRoot(), stdio: "ignore", timeout: 180_000 });
    return `${base}.zip`;
  }
}

async function walk(
  dir: string,
  projectRoot: string,
  out: { path: string; sha256: string; size: number }[],
): Promise<void> {
  const entries = await fsp.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      await walk(full, projectRoot, out);
    } else if (e.isFile()) {
      const data = await fsp.readFile(full);
      const sha = crypto.createHash("sha256").update(data).digest("hex");
      const rel = path.relative(projectRoot, full).replace(/\\/g, "/");
      out.push({ path: rel, sha256: sha, size: data.length });
    }
  }
}

export async function verifyManifest(slot: number): Promise<{ ok: boolean; missing: string[]; mismatched: string[] }> {
  const mp = path.join(snapshotsDir(), `slot-${slot}.manifest.json`);
  const raw = await fsp.readFile(mp, "utf8");
  const manifest = JSON.parse(raw) as {
    files: { path: string; sha256: string; size: number }[];
  };
  const missing: string[] = [];
  const mismatched: string[] = [];
  // Validate CURRENT files on disk against manifest (optional pre-check)
  for (const f of manifest.files) {
    const full = path.join(resolveProjectRoot(), f.path);
    try {
      const data = await fsp.readFile(full);
      const sha = crypto.createHash("sha256").update(data).digest("hex");
      if (sha !== f.sha256) mismatched.push(f.path);
    } catch {
      missing.push(f.path);
    }
  }
  return { ok: missing.length === 0 && mismatched.length === 0, missing, mismatched };
}

export async function getFreeSpaceGB(): Promise<number> {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-PSDrive C).Free / 1GB"`,
      { encoding: "utf8", timeout: 10_000 },
    );
    const n = parseFloat(out.trim());
    return isFinite(n) ? n : 999;
  } catch {
    return 999;
  }
}

export async function pruneOldSnapshots(currentSlot: number): Promise<number> {
  const free = await getFreeSpaceGB();
  if (free >= DEFAULTS.DISK_MIN_FREE_GB) return 0;
  let pruned = 0;
  const threshold = currentSlot - 5;
  try {
    const entries = await fsp.readdir(snapshotsDir());
    for (const name of entries) {
      const m = name.match(/^slot-(\d+)\.(tar|zip|manifest\.json)$/);
      if (!m) continue;
      const slot = parseInt(m[1], 10);
      if (slot <= threshold) {
        await fsp.unlink(path.join(snapshotsDir(), name));
        pruned += 1;
      }
    }
  } catch {
    // ignore
  }
  return pruned;
}

// --- retro / scout feed ---

export async function writeRetro(slot: number, agentId: AgentId, entry: RetroEntry): Promise<void> {
  const dir = slotDir(slot);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, `retro-${agentId}.json`), JSON.stringify(entry, null, 2));
}

export async function aggregateRetro(slot: number): Promise<SlotRetro> {
  const dir = slotDir(slot);
  await fsp.mkdir(dir, { recursive: true });
  const entries: SlotRetro["entries"] = {
    ultron: null,
    nova: null,
    forge: null,
    ares: null,
    echo: null,
    midas: null,
  };
  let files: string[] = [];
  try {
    files = await fsp.readdir(dir);
  } catch {
    // empty
  }
  for (const f of files) {
    const m = f.match(/^retro-(\w+)\.json$/);
    if (!m) continue;
    const id = m[1] as AgentId;
    try {
      const raw = await fsp.readFile(path.join(dir, f), "utf8");
      entries[id] = JSON.parse(raw) as RetroEntry;
    } catch {
      // skip
    }
  }
  const retro: SlotRetro = {
    slot,
    ts: new Date().toISOString(),
    entries,
    greenCount: Object.values(entries).filter((e) => e && e.blockers.length === 0).length,
    redCount: Object.values(entries).filter((e) => e && e.blockers.length > 0).length,
  };
  await fsp.writeFile(path.join(dir, "retro.json"), JSON.stringify(retro, null, 2));
  return retro;
}

export async function writeGate(slot: number, gate: GateVerdict): Promise<void> {
  const dir = slotDir(slot);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(path.join(dir, "gate.json"), JSON.stringify(gate, null, 2));
}

export async function readGate(slot: number): Promise<GateVerdict | null> {
  try {
    const raw = await fsp.readFile(path.join(slotDir(slot), "gate.json"), "utf8");
    return JSON.parse(raw) as GateVerdict;
  } catch {
    return null;
  }
}

export async function appendScoutIdea(idea: ScoutIdea): Promise<void> {
  await ensureDirs();
  await fsp.appendFile(scoutFeedPath(), JSON.stringify(idea) + "\n");
}

export async function readScoutFeed(sinceTs?: string, max = 200): Promise<ScoutIdea[]> {
  try {
    const raw = await fsp.readFile(scoutFeedPath(), "utf8");
    const lines = raw.split(/\n/).filter((l) => l.trim().length > 0);
    const out: ScoutIdea[] = [];
    for (const l of lines) {
      try {
        const idea = JSON.parse(l) as ScoutIdea;
        if (sinceTs && idea.ts < sinceTs) continue;
        out.push(idea);
      } catch {
        // bad line
      }
    }
    return out.slice(-max);
  } catch {
    return [];
  }
}
