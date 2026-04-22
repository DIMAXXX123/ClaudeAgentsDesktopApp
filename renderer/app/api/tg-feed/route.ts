import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FEED_PATH =
  process.env.TG_FEED_PATH ||
  path.join(
    os.homedir(),
    "Documents",
    "claude-workspace",
    "telegram-bot",
    "data",
    "tg_feed.jsonl",
  );

type FeedEntry = {
  t: number;
  dir: "in" | "out";
  user: number;
  name: string;
  text: string;
};

async function readTail(filePath: string, approxBytes: number): Promise<string> {
  try {
    const stat = await fs.stat(filePath);
    const start = Math.max(0, stat.size - approxBytes);
    const fh = await fs.open(filePath, "r");
    try {
      const buf = Buffer.alloc(stat.size - start);
      await fh.read(buf, 0, buf.length, start);
      return buf.toString("utf-8");
    } finally {
      await fh.close();
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return "";
    throw err;
  }
}

export async function GET(req: NextRequest) {
  const parsed = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "30", 10);
  const limit = Math.min(Math.max(Number.isFinite(parsed) ? parsed : 30, 1), 200);
  try {
    const raw = await readTail(FEED_PATH, 64 * 1024);
    const lines = raw.split("\n").filter((l) => l.trim());
    const entries: FeedEntry[] = [];
    for (const line of lines) {
      try {
        const raw = JSON.parse(line) as Partial<FeedEntry>;
        if (
          typeof raw.t === "number" &&
          (raw.dir === "in" || raw.dir === "out") &&
          typeof raw.text === "string"
        ) {
          entries.push({
            t: raw.t,
            dir: raw.dir,
            user: typeof raw.user === "number" ? raw.user : 0,
            name: typeof raw.name === "string" ? raw.name : "user",
            text: raw.text,
          });
        }
      } catch {
        // skip partial/corrupt line (e.g. mid-write)
      }
    }
    const tail = entries.slice(-limit);
    return NextResponse.json(
      { ok: true, entries: tail },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err), entries: [] },
      { status: 500 },
    );
  }
}
