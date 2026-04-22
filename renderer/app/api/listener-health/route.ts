import { NextResponse } from "next/server";
import { exec } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execP = promisify(exec);

const BOT_DIR =
  process.env.BOT_DIR ||
  path.join(os.homedir(), "Documents", "claude-workspace", "telegram-bot");
const ENV_PATH = path.join(BOT_DIR, ".env");
const SESSIONS_PATH = path.join(BOT_DIR, "data", "sessions.json");
const LOG_PATH = path.join(BOT_DIR, "data", "simple_bot.log");

type ListenerProc = { pid: number; startedAt: string | null };

type Health = {
  alive: boolean;
  simpleBot: boolean;
  proc: ListenerProc | null;
  cwd: string;
  botUsername: string;
  allowedUsers: number[];
  sessions: Array<{ user: string; sessionId: string }>;
  lastLogLine: string | null;
  checkedAt: number;
  error?: string;
};

async function readEnv(): Promise<Record<string, string>> {
  try {
    const raw = await fs.readFile(ENV_PATH, "utf-8");
    const out: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i.exec(line);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      out[m[1]] = v;
    }
    return out;
  } catch {
    return {};
  }
}

async function readSessions(): Promise<Array<{ user: string; sessionId: string }>> {
  try {
    const raw = await fs.readFile(SESSIONS_PATH, "utf-8");
    const data = JSON.parse(raw) as Record<string, string>;
    return Object.entries(data).map(([user, sessionId]) => ({ user, sessionId }));
  } catch {
    return [];
  }
}

async function readLastLogLine(): Promise<string | null> {
  try {
    const stat = await fs.stat(LOG_PATH);
    const start = Math.max(0, stat.size - 4096);
    const fh = await fs.open(LOG_PATH, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      await fh.read(buf, 0, buf.length, start);
      const lines = buf.toString("utf-8").split(/\r?\n/).filter((l) => l.trim());
      return lines.length ? lines[lines.length - 1] : null;
    } finally {
      await fh.close();
    }
  } catch {
    return null;
  }
}

async function probeProcess(): Promise<ListenerProc | null> {
  const cmd =
    'powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process -Filter ' +
    "\\\"Name='python.exe' OR Name='pythonw.exe'\\\" | " +
    'Where-Object { $_.CommandLine -match \'simple_bot\\.py\' } | ' +
    'Select-Object ProcessId, CreationDate | ConvertTo-Json -Compress"';
  try {
    const { stdout } = await execP(cmd, { timeout: 4000, windowsHide: true });
    const out = stdout.trim();
    if (!out) return null;
    const parsed: unknown = JSON.parse(out);
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (!first || typeof first !== "object") return null;
    const pid = (first as { ProcessId?: number }).ProcessId;
    const rawStarted = (first as { CreationDate?: string }).CreationDate ?? null;
    return { pid: typeof pid === "number" ? pid : 0, startedAt: rawStarted };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const [env, sessions, lastLogLine, proc] = await Promise.all([
      readEnv(),
      readSessions(),
      readLastLogLine(),
      probeProcess(),
    ]);

    const allowedUsers = (env.ALLOWED_USERS ?? "")
      .split(",")
      .map((s) => Number.parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n));

    const health: Health = {
      alive: proc !== null,
      simpleBot: proc !== null,
      proc,
      cwd: env.APPROVED_DIRECTORY ?? "C:\\Users\\Dimax",
      botUsername: "@OpenClawDimaxbot",
      allowedUsers,
      sessions,
      lastLogLine,
      checkedAt: Date.now(),
    };
    return NextResponse.json(health, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const fallback: Health = {
      alive: false,
      simpleBot: false,
      proc: null,
      cwd: "",
      botUsername: "@OpenClawDimaxbot",
      allowedUsers: [],
      sessions: [],
      lastLogLine: null,
      checkedAt: Date.now(),
      error: err instanceof Error ? err.message : String(err),
    };
    return NextResponse.json(fallback, { status: 500 });
  }
}
