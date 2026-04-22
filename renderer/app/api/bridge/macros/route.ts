/**
 * /api/bridge/macros — server-side macro persistence.
 * GET  → load macros from disk (per-server store, fallback)
 * POST → save macros to disk
 *
 * In prod, swap the file-based store for a DB (Supabase / Redis).
 */

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import type { Macro } from "@/lib/orchestration/macroStore";

const STORE_PATH = path.join(process.cwd(), ".next", "cache", "bridge-macros.json");

async function readStore(): Promise<Macro[]> {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf-8");
    return JSON.parse(raw) as Macro[];
  } catch {
    return [];
  }
}

async function writeStore(macros: Macro[]): Promise<void> {
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(macros, null, 2), "utf-8");
  } catch {
    // graceful — localStorage is the primary store
  }
}

export async function GET(): Promise<NextResponse> {
  const macros = await readStore();
  return NextResponse.json({ ok: true, macros });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    if (!Array.isArray(body)) {
      return NextResponse.json({ ok: false, error: "expected array" }, { status: 400 });
    }
    // Basic shape validation
    const valid = body.every(
      (m): m is Macro =>
        typeof m === "object" &&
        m !== null &&
        typeof m.id === "string" &&
        typeof m.name === "string" &&
        typeof m.keybinding === "string" &&
        typeof m.action === "object",
    );
    if (!valid) {
      return NextResponse.json({ ok: false, error: "invalid macro shape" }, { status: 400 });
    }
    await writeStore(body);
    return NextResponse.json({ ok: true, saved: body.length });
  } catch {
    return NextResponse.json({ ok: false, error: "parse error" }, { status: 400 });
  }
}

export async function DELETE(): Promise<NextResponse> {
  await writeStore([]);
  return NextResponse.json({ ok: true });
}
