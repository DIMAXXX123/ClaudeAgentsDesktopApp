/**
 * GET  /api/analytics/cost  → CostSummary with seeded demo data
 * POST /api/analytics/cost  → Record a new UsageRecord
 *
 * Because Next.js server routes don't have access to the client localStorage,
 * this route maintains its own in-process array of records (survives HMR but
 * resets on cold start). The authoritative copy lives in client localStorage;
 * this endpoint is used for SSR hydration and for external agent calls.
 */

import { NextResponse } from "next/server";
import {
  calcCost,
  aggregateRecords,
  generateSeedRecords,
  MODEL_PRICING,
  type UsageRecord,
  type ModelId,
} from "@/lib/analytics/costStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── In-memory store (server-side) ───────────────────────────────────────────

let _serverRecords: UsageRecord[] | null = null;

function getServerRecords(): UsageRecord[] {
  if (_serverRecords === null) {
    // Seed on first request
    _serverRecords = generateSeedRecords(60);
  }
  return _serverRecords;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get("days") ?? "7", 10);
  const model = url.searchParams.get("model") as ModelId | null;

  const records = getServerRecords();
  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  let filtered = records.filter((r) => new Date(r.ts).getTime() >= cutoff);
  if (model && model in MODEL_PRICING) {
    filtered = filtered.filter((r) => r.model === model);
  }

  const summary = aggregateRecords(filtered);

  return NextResponse.json({
    ok: true,
    days,
    modelFilter: model ?? null,
    summary,
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

interface RecordBody {
  model: ModelId;
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
      { error: "Missing required fields: model, inputTokens, outputTokens" },
      { status: 400 },
    );
  }

  const b = body as RecordBody;

  if (!(b.model in MODEL_PRICING)) {
    return NextResponse.json(
      {
        error: `Unknown model '${b.model}'. Available: ${Object.keys(MODEL_PRICING).join(", ")}`,
      },
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
    id: `api-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ts: new Date().toISOString(),
    model: b.model,
    inputTokens: b.inputTokens,
    outputTokens: b.outputTokens,
    costUsd: calcCost(b.model, b.inputTokens, b.outputTokens),
    sessionId: typeof b.sessionId === "string" ? b.sessionId : undefined,
    task: typeof b.task === "string" ? b.task : undefined,
  };

  getServerRecords().push(record);

  return NextResponse.json({ ok: true, record }, { status: 201 });
}
