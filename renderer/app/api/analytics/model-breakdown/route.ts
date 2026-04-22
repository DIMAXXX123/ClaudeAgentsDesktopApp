/**
 * GET /api/analytics/model-breakdown
 *
 * Returns per-model cost breakdown table data.
 *
 * Query params:
 *   days   number  Calendar days to include (default 7, max 90)
 *   format "json" | "csv"   Response format (default "json")
 */

import { NextResponse } from "next/server";
import { buildModelBreakdown, breakdownToCsv } from "@/lib/analytics/modelBreakdown";
import { generateSeedRecords } from "@/lib/analytics/costStore";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ─── Shared seed (same lifetime as process) ───────────────────────────────────

let _records: ReturnType<typeof generateSeedRecords> | null = null;

function getRecords() {
  if (_records === null) {
    _records = generateSeedRecords(90);
  }
  return _records;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const url = new URL(req.url);

  const rawDays = parseInt(url.searchParams.get("days") ?? "7", 10);
  const days = Math.max(1, Math.min(90, isNaN(rawDays) ? 7 : rawDays));

  const format = url.searchParams.get("format") ?? "json";
  if (format !== "json" && format !== "csv") {
    return NextResponse.json(
      { error: "Invalid format. Use 'json' or 'csv'." },
      { status: 400 },
    );
  }

  const records = getRecords();
  const result = buildModelBreakdown(records, days);

  if (format === "csv") {
    const csv = breakdownToCsv(result);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="model-breakdown-${days}d.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, days, ...result });
}
