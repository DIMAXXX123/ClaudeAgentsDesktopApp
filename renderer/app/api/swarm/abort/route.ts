import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import type { SwarmPlan } from "@/lib/swarm/types";

const SWARM_DATA_DIR = process.env.SWARM_DATA_DIR || "/tmp/swarm-plans";

export async function POST(request: NextRequest) {
  try {
    const { planId } = await request.json();

    if (!planId || typeof planId !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid planId" },
        { status: 400 }
      );
    }

    const planPath = path.join(SWARM_DATA_DIR, `${planId}.json`);
    const planData = await fsp.readFile(planPath, "utf-8");
    const plan: SwarmPlan = JSON.parse(planData);

    // Mark all running tasks as aborted
    for (const task of plan.tasks) {
      if (task.status === "running" || task.status === "pending") {
        task.status = "skipped";
        task.finishedAt = Date.now();
      }
    }

    plan.status = "aborted";
    await fsp.writeFile(planPath, JSON.stringify(plan, null, 2));

    return NextResponse.json({ message: "Swarm aborted", planId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
