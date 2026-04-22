/**
 * GET /api/analytics/waterfall
 *
 * Returns WaterfallSeries data for the CostWaterfallChart component.
 * Accepts the same seeded server-side record set as /api/analytics/cost.
 *
 * Query params:
 *   days    number  How many calendar days to include (default 7, max 90)
 *   group   "model" | "category"  Primary grouping dimension (default "model")
 */

import { NextResponse } from "next/server";
import { buildWaterfallSeries } from "@/lib/analytics/waterfallStore";
import { generateSeedRecords } from "@/lib/analytics/costStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Shared seed (same lifetime as the process, mirrors /api/analytics/cost) ─

let _serverRecords: ReturnType<typeof generateSeedRecords> | null = null;

function getServerRecords() {
  if (_serverRecords === null) {
    _serverRecords = generateSeedRecords(90); // more records for 30-day view
  }
  return _serverRecords;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);

  const rawDays = parseInt(url.searchParams.get("days") ?? "7", 10);
  const days = Math.max(1, Math.min(90, isNaN(rawDays) ? 7 : rawDays));

  const group = url.searchParams.get("group") ?? "model";
  if (group !== "model" && group !== "category") {
    return NextResponse.json(
      { error: "Invalid group param. Use 'model' or 'category'." },
      { status: 400 },
    );
  }

  const records = getServerRecords();
  const series = buildWaterfallSeries(records, days);

  return NextResponse.json({
    ok: true,
    days,
    group,
    series,
  });
}
