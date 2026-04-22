import { Anthropic } from "@anthropic-ai/sdk";
import { AGENTS } from "../agents";
import type { SwarmPlan, SwarmTask } from "./types";
import { getModeConfig } from "./modeResolver";

export interface ExecutorCallbacks {
  onTaskStart: (taskId: string) => void;
  onTaskOutput: (taskId: string, chunk: string) => void;
  onTaskDone: (taskId: string, output: string) => void;
  onTaskError: (taskId: string, err: string) => void;
}

async function executeTask(
  task: SwarmTask,
  plan: SwarmPlan,
  callbacks: ExecutorCallbacks,
): Promise<void> {
  callbacks.onTaskStart(task.id);

  task.status = "running";
  task.startedAt = Date.now();

  try {
    const agent = AGENTS[task.agentId] || AGENTS.ultron;
    const modeConfig = getModeConfig();
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    let fullOutput = "";
    const message = await client.messages.create({
      model: modeConfig.workerModel,
      max_tokens: 4096,
      system: agent.systemPrompt,
      messages: [
        {
          role: "user",
          content: task.prompt,
        },
      ],
    });

    if (message.content[0].type === "text") {
      fullOutput = message.content[0].text;
    } else if (message.content[0].type === "tool_use") {
      fullOutput = `Tool call: ${message.content[0].name}`;
    }

    callbacks.onTaskOutput(task.id, fullOutput);

    task.status = "done";
    task.output = fullOutput;
    task.finishedAt = Date.now();
    callbacks.onTaskDone(task.id, fullOutput);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    task.status = "failed";
    task.error = errorMsg;
    task.finishedAt = Date.now();
    callbacks.onTaskError(task.id, errorMsg);
  }
}

function topologicalSort(tasks: SwarmTask[]): SwarmTask[] {
  const sorted: SwarmTask[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(task: SwarmTask) {
    if (visited.has(task.id)) return;
    if (visiting.has(task.id)) {
      throw new Error(`Circular dependency detected at task ${task.id}`);
    }

    visiting.add(task.id);

    for (const depId of task.deps) {
      const depTask = tasks.find((t) => t.id === depId);
      if (depTask) {
        visit(depTask);
      }
    }

    visiting.delete(task.id);
    visited.add(task.id);
    sorted.push(task);
  }

  for (const task of tasks) {
    visit(task);
  }

  return sorted;
}

export async function executeSwarm(
  plan: SwarmPlan,
  callbacks: ExecutorCallbacks,
): Promise<SwarmPlan> {
  // Validate and sort tasks
  topologicalSort(plan.tasks);

  plan.status = "running";

  const running = new Set<string>();
  const done = new Set<string>();
  const modeConfig = getModeConfig();
  const MAX_PARALLEL = modeConfig.maxParallel;

  while (done.size < plan.tasks.length) {
    // Find tasks ready to run (all deps done, not yet started)
    const ready = plan.tasks.filter(
      (t) =>
        t.status === "pending" &&
        t.deps.every((depId) => done.has(depId))
    );

    // Start new tasks up to parallelism limit
    while (running.size < MAX_PARALLEL && ready.length > 0) {
      const task = ready.shift()!;
      running.add(task.id);

      executeTask(task, plan, callbacks)
        .then(() => {
          running.delete(task.id);
          done.add(task.id);
        })
        .catch(() => {
          running.delete(task.id);
          done.add(task.id);
        });
    }

    // Wait for at least one task to complete before checking again
    if (running.size > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else if (ready.length === 0 && done.size < plan.tasks.length) {
      // Deadlock detection: no running, no ready, but not done
      const pending = plan.tasks.filter((t) => t.status === "pending");
      if (pending.length > 0) {
        plan.status = "failed";
        throw new Error("Deadlock: tasks waiting for unmet dependencies");
      }
    }
  }

  // Check final status
  const failed = plan.tasks.filter((t) => t.status === "failed");
  plan.status = failed.length > 0 ? "failed" : "done";

  return plan;
}
