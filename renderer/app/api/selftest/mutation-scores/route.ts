/**
 * GET  /api/selftest/mutation-scores
 *   Returns the rolling history of mutation runs with per-commit score deltas.
 *   Powers the selftest dashboard sparkline.
 *
 * POST /api/selftest/mutation-scores
 *   Records a new mutation run.
 *   Body: { commitSha, score, killedMutants, totalMutants, ts? }
 *
 * Both endpoints are public (no auth) — they operate only on volatile
 * in-memory data and expose no secrets.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  computeScoreDeltas,
  getMutationHistory,
  recordMutationRun,
  getLatestRun,
  type MutationRun,
} from "@/lib/selftest/mutationScore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const history = getMutationHistory();
  const deltas = computeScoreDeltas();
  const latest = getLatestRun();

  return NextResponse.json({
    ts: new Date().toISOString(),
    windowSize: history.length,
    latest,
    deltas,
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

type RecordBody = {
  commitSha: string;
  score: number;
  killedMutants: number;
  totalMutants: number;
  ts?: string;
};

export async function POST(req: NextRequest) {
  let body: RecordBody;
  try {
    body = (await req.json()) as RecordBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { commitSha, score, killedMutants, totalMutants, ts } = body;

  // ── Validation ──────────────────────────────────────────────────────────────

  const missing = (["commitSha", "score", "killedMutants", "totalMutants"] as const)
    .filter((k) => body[k] === undefined || body[k] === null);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: `Missing required fields: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  if (typeof commitSha !== "string" || commitSha.trim().length === 0) {
    return NextResponse.json({ error: "commitSha must be a non-empty string" }, { status: 400 });
  }
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return NextResponse.json({ error: "score must be a finite number" }, { status: 400 });
  }
  if (!Number.isInteger(killedMutants) || killedMutants < 0) {
    return NextResponse.json(
      { error: "killedMutants must be a non-negative integer" },
      { status: 400 },
    );
  }
  if (!Number.isInteger(totalMutants) || totalMutants <= 0) {
    return NextResponse.json(
      { error: "totalMutants must be a positive integer" },
      { status: 400 },
    );
  }
  if (killedMutants > totalMutants) {
    return NextResponse.json(
      { error: "killedMutants cannot exceed totalMutants" },
      { status: 400 },
    );
  }
  if (ts !== undefined && isNaN(Date.parse(ts))) {
    return NextResponse.json({ error: "ts must be a valid ISO-8601 string" }, { status: 400 });
  }

  // ── Record ──────────────────────────────────────────────────────────────────

  try {
    const run: MutationRun = recordMutationRun({
      commitSha: commitSha.trim().slice(0, 12),
      score,
      killedMutants,
      totalMutants,
      ...(ts ? { ts } : {}),
    });

    return NextResponse.json({ recorded: run, windowSize: getMutationHistory().length }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
