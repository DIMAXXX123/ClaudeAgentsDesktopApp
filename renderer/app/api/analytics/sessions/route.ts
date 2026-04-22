/**
 * GET /api/analytics/sessions
 *
 * Returns SessionTimelineData — sessions with per-agent burn rates,
 * sparkline time-series, and a rolling 24h cost projection.
 *
 * Query params:
 *   hours  - look-back window in hours (default: 48)
 *   window - projection window in minutes (default: 60)
 */

import { NextResponse } from "next/server";
import {
  generateSeedRecords,
  type UsageRecord,
} from "@/lib/analytics/costStore";
import {
  buildSessionTimeline,
  generateTimelineSeedRecords,
  calcRollingProjection,
} from "@/lib/analytics/sessionTimeline";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── In-memory store (server-side, reset on cold boot) ───────────────────────

let _records: UsageRecord[] | null = null;

function getRecords(): UsageRecord[] {
  if (_records === null) {
    // Merge cost seed records with timeline-specific seed (which have richer sessionId/task)
    const costSeeds = generateSeedRecords(40);
    const timelineSeeds = generateTimelineSeedRecords(6);
    _records = [...costSeeds, ...timelineSeeds].sort((a, b) =>
      a.ts.localeCompare(b.ts),
    );
  }
  return _records;
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const hours = Math.min(
    168, // max 7 days
    Math.max(1, parseInt(url.searchParams.get("hours") ?? "48", 10)),
  );
  const windowMin = Math.min(
    1440,
    Math.max(5, parseInt(url.searchParams.get("window") ?? "60", 10)),
  );

  const allRecords = getRecords();
  const cutoff = Date.now() - hours * 3600_000;
  const filtered = allRecords.filter(
    (r) => new Date(r.ts).getTime() >= cutoff,
  );

  const timeline = buildSessionTimeline(filtered);

  // Re-compute projection with the requested window (may differ from default 60)
  const projection = calcRollingProjection(filtered, windowMin);

  return NextResponse.json({
    ok: true,
    hours,
    windowMin,
    ...timeline,
    projection,
  });
}

// ─── POST /api/analytics/sessions — append a record ──────────────────────────

interface RecordBody {
  model: string;
  inputTokens: number;
  outputTokens: number;
  sessionId?: string;
  task?: string;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("model" in body) ||
    !("inputTokens" in body) ||
    !("outputTokens" in body)
  ) {
    return NextResponse.json(
      { error: "Required: model, inputTokens, outputTokens" },
      { status: 400 },
    );
  }

  const b = body as RecordBody;
  const { calcCost, MODEL_PRICING } = await import("@/lib/analytics/costStore");

  if (!(b.model in MODEL_PRICING)) {
    return NextResponse.json(
      { error: `Unknown model '${b.model}'` },
      { status: 400 },
    );
  }

  if (
    typeof b.inputTokens !== "number" ||
    typeof b.outputTokens !== "number" ||
    b.inputTokens < 0 ||
    b.outputTokens < 0
  ) {
    return NextResponse.json(
      { error: "inputTokens and outputTokens must be non-negative numbers" },
      { status: 400 },
    );
  }

  const record: UsageRecord = {
    id: `sess-api-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
    model: b.model as UsageRecord["model"],
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    costUsd: calcCost(
      b.model as UsageRecord["model"],
      b.inputTokens,
      b.outputTokens,
    ),
    sessionId: typeof b.sessionId === "string" ? b.sessionId : undefined,
    task: typeof b.task === "string" ? b.task : undefined,
  };

  getRecords().push(record);

  return NextResponse.json({ ok: true, record }, { status: 201 });
}
