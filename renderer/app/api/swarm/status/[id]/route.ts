import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import type { SwarmPlan } from "@/lib/swarm/types";

const SWARM_DATA_DIR = process.env.SWARM_DATA_DIR || "/tmp/swarm-plans";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid id" },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    const planPath = path.join(SWARM_DATA_DIR, `${id}.json`);
    const planData = await fsp.readFile(planPath, "utf-8");
    let plan: SwarmPlan;
    try {
      plan = JSON.parse(planData) as SwarmPlan;
    } catch {
      return NextResponse.json({ error: "Plan file corrupted" }, { status: 500 });
    }

    return NextResponse.json(plan);
  } catch (error) {
    if (error instanceof Error && error.message.includes("ENOENT")) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }
    console.error("[swarm/status] error", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
