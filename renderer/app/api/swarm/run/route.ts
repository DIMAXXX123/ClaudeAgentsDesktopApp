import { NextRequest, NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";
import { executeSwarm } from "@/lib/swarm/executor";
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

    // Run swarm in background with callbacks
    const callbacks = {
      onTaskStart: (taskId: string) => {
        const task = plan.tasks.find((t) => t.id === taskId);
        if (task) {
          task.status = "running";
          task.startedAt = Date.now();
        }
      },
      onTaskOutput: (taskId: string, chunk: string) => {
        // Could stream to client if needed
      },
      onTaskDone: (taskId: string, output: string) => {
        const task = plan.tasks.find((t) => t.id === taskId);
        if (task) {
          task.status = "done";
          task.output = output;
          task.finishedAt = Date.now();
        }
      },
      onTaskError: (taskId: string, err: string) => {
        const task = plan.tasks.find((t) => t.id === taskId);
        if (task) {
          task.status = "failed";
          task.error = err;
          task.finishedAt = Date.now();
        }
      },
    };

    // Execute swarm asynchronously
    executeSwarm(plan, callbacks).then(async (updatedPlan) => {
      await fsp.writeFile(
        planPath,
        JSON.stringify(updatedPlan, null, 2)
      );
    });

    return NextResponse.json({ message: "Swarm execution started", planId });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
