import { Anthropic } from "@anthropic-ai/sdk";
import type { SwarmPlan, SwarmTask } from "./types";

const ORCHESTRATOR_PROMPT = `You are an orchestrator of AI agents. Given a goal, decompose it into a DAG (directed acyclic graph) of subtasks.

Agent specializations:
- ULTRON: system architect, meta-orchestration, multi-step plans, routing
- NOVA: deep research, web lookups, code audits, library APIs, citation extraction
- FORGE: building new code, scaffolds, migrations, package installs, build chains
- ARES: debugging, root-cause analysis, patching, stack traces, error logs
- ECHO: APIs, webhooks, integrations, HTTP glue, Telegram bots, SMTP
- MIDAS: data analysis, CSV/JSON transforms, metrics, disk usage, charts

Rules:
1. Return ONLY valid JSON (no markdown, no extra text)
2. Each task must have: id (string, unique), title (string), agentId (string, one of above), prompt (string, self-contained), deps (string[], ids of dependency tasks)
3. Dependencies must form a DAG — NO CYCLES
4. Max 12 tasks per plan (budget constraint)
5. Parallelize where possible (fewer deps = faster execution)
6. Each prompt must be complete and not reference other tasks' outputs by name

Return JSON schema:
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Task title",
      "agentId": "ULTRON" | "NOVA" | "FORGE" | "ARES" | "ECHO" | "MIDAS",
      "prompt": "Self-contained prompt",
      "deps": []
    }
  ]
}`;

interface DecomposeResponse {
  tasks: Array<{
    id: string;
    title: string;
    agentId: string;
    prompt: string;
    deps: string[];
  }>;
}

export async function decomposeGoal(goal: string): Promise<SwarmPlan> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-1",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `Goal: ${goal}\n\nDecompose into a task DAG and return JSON.`,
        },
      ],
      system: ORCHESTRATOR_PROMPT,
    });

    const responseText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let parsed: DecomposeResponse;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]);
      } else {
        throw new Error(`Failed to parse decompose response: ${responseText}`);
      }
    }

    if (!parsed.tasks || !Array.isArray(parsed.tasks)) {
      throw new Error("Invalid response structure: missing tasks array");
    }

    const planId = `swarm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const tasks: SwarmTask[] = parsed.tasks.map((t) => ({
      id: t.id,
      title: t.title,
      agentId: t.agentId.toLowerCase(),
      prompt: t.prompt,
      deps: t.deps || [],
      status: "pending" as const,
    }));

    return {
      id: planId,
      goal,
      createdAt: Date.now(),
      tasks,
      status: "planning",
    };
  } catch (error) {
    throw new Error(
      `Failed to decompose goal: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
