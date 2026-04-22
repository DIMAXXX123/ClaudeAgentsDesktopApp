import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import { decomposeGoal } from "@/lib/swarm/decompose";
import type { SwarmPlan } from "@/lib/swarm/types";

const SWARM_DATA_DIR = process.env.SWARM_DATA_DIR || "/tmp/swarm-plans";

async function ensureDir(dir: string) {
  try {
    await fsp.mkdir(dir, { recursive: true });
  } catch {
    // ignore
  }
}

export async function POST(request: NextRequest) {
  try {
    const { goal } = await request.json();

    if (!goal || typeof goal !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid goal" },
        { status: 400 }
      );
    }

    const plan = await decomposeGoal(goal);

    // Save plan to disk
    await ensureDir(SWARM_DATA_DIR);
    const planPath = path.join(SWARM_DATA_DIR, `${plan.id}.json`);
    await fsp.writeFile(planPath, JSON.stringify(plan, null, 2));

    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
