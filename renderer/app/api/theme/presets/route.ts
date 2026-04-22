/**
 * /api/theme/presets
 *
 * Server-side mirror for workspace presets.
 * Client localStorage is the source of truth; this API exists so
 * server-side agents (conductor, scripts) can read / import / export presets.
 *
 * GET    → list all presets
 * POST   → create / overwrite a preset   { name, layout }
 * DELETE → delete a preset by id          ?id=preset-xxx
 */

import { NextResponse } from "next/server";
import type { WorkspacePreset, PanelRect } from "@/lib/theme/panelLayoutStore";

// ─── In-memory store (lives for the server process lifetime) ─────────────────

const _presets = new Map<string, WorkspacePreset>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isValidLayout(layout: unknown): layout is Record<string, PanelRect> {
  if (typeof layout !== "object" || layout === null) return false;
  return Object.values(layout).every(
    (v) =>
      typeof v === "object" &&
      v !== null &&
      typeof (v as Record<string, unknown>).x === "number" &&
      typeof (v as Record<string, unknown>).y === "number" &&
      typeof (v as Record<string, unknown>).w === "number" &&
      typeof (v as Record<string, unknown>).h === "number",
  );
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const list = Array.from(_presets.values()).sort((a, b) => a.createdAt - b.createdAt);
  return NextResponse.json({ presets: list, count: list.length });
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const { name, layout, id } = body as Record<string, unknown>;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Missing or empty 'name'" }, { status: 400 });
  }

  if (!isValidLayout(layout)) {
    return NextResponse.json(
      {
        error:
          "Invalid 'layout': must be Record<string, {x,y,w,h}> with all numeric fields",
      },
      { status: 400 },
    );
  }

  const presetId =
    typeof id === "string" && id.trim() ? id.trim() : `preset-${Date.now()}`;

  const preset: WorkspacePreset = {
    id: presetId,
    name: name.trim(),
    createdAt: Date.now(),
    layout,
  };

  _presets.set(presetId, preset);

  return NextResponse.json({ preset }, { status: _presets.has(presetId) ? 200 : 201 });
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing 'id' query param" }, { status: 400 });
  }

  if (!_presets.has(id)) {
    return NextResponse.json({ error: `Preset '${id}' not found` }, { status: 404 });
  }

  _presets.delete(id);
  return NextResponse.json({ deleted: id });
}
