/**
 * GET /api/selftest
 *
 * Runs all registered ULTRONOS invariant checkers and returns a JSON report.
 * Useful for CI health checks, monitoring dashboards, and overnight gate verdicts.
 *
 * Response shape: SelftestReport from lib/selftest/invariants.ts
 */
import { NextResponse } from "next/server";
import { runSelftest } from "@/lib/selftest/invariants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const report = runSelftest();
    const status = report.allOk ? 200 : 500;
    return NextResponse.json(report, { status });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        ts: new Date().toISOString(),
        allOk: false,
        results: [
          {
            name: "selftest-runner",
            ok: false,
            violations: [`Selftest runner threw: ${message}`],
          },
        ],
      },
      { status: 500 },
    );
  }
}
