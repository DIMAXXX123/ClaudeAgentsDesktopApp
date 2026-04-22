import { query } from "@anthropic-ai/claude-agent-sdk";
import { AGENTS } from "@/lib/agents";
import { unfixed, markFixed } from "@/lib/bugCollector";
import { execSync } from "node:child_process";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PROJECT = path.resolve(process.cwd());

const ALLOWED_COMMANDS = [
  "npx tsc --noEmit",
  "npx eslint",
  "npx vitest run",
  "npm run typecheck",
];

function validateCommand(cmd: string): boolean {
  return ALLOWED_COMMANDS.some((allowed) => cmd.startsWith(allowed));
}

function safeRun(cmd: string, timeoutMs = 60_000): string {
  if (!validateCommand(cmd)) {
    console.error(`Command not whitelisted: ${cmd}`);
    return "Error: command not whitelisted";
  }
  try {
    return execSync(cmd, {
      cwd: PROJECT,
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).toString();
  } catch (e) {
    const err = e as { stdout?: Buffer | string; stderr?: Buffer | string; message?: string };
    return String(err.stdout ?? "") + "\n" + String(err.stderr ?? "") + "\n" + String(err.message ?? "");
  }
}

export async function POST() {
  const now = Date.now();
  const bugs = unfixed().slice(0, 30);

  // Collect static signals
  const tsOutput = safeRun("npx tsc --noEmit");
  const testOutput = safeRun("npx vitest run --reporter=dot", 120_000);

  const tsClean = /\bFound 0 errors\b/i.test(tsOutput) || tsOutput.trim().length === 0;
  const testsPass = /Tests\s+\d+ passed/.test(testOutput) && !/failed/i.test(testOutput);

  if (bugs.length === 0 && tsClean && testsPass) {
    return Response.json({
      status: "clean",
      message: "No bugs, typecheck clean, tests passing.",
      signals: { tsClean, testsPass, bugs: 0 },
    });
  }

  const agentsMap: Record<string, { description: string; prompt: string; tools: string[] }> = {};
  for (const a of Object.values(AGENTS)) {
    agentsMap[a.id] = {
      description: a.description,
      prompt: a.systemPrompt,
      tools: a.allowedTools,
    };
  }

  const briefing = `
Autofix cycle. Project path: ${PROJECT}

=== CLIENT/SERVER BUG LOG (${bugs.length} unfixed) ===
${bugs
  .slice(0, 15)
  .map((b, i) => `[${i + 1}] ${b.source}/${b.kind}: ${b.message}${b.stack ? "\n" + b.stack.slice(0, 400) : ""}`)
  .join("\n\n") || "(empty)"}

=== TYPECHECK OUTPUT ===
${tsOutput.slice(-2000) || "(empty / clean)"}

=== VITEST OUTPUT ===
${testOutput.slice(-2000) || "(empty)"}

TASK:
1. Identify the root cause of each signal above.
2. Apply surgical fixes using Edit/Write to this project's files.
3. Delegate research to NOVA (Agent tool, subagent_type: "nova") if you need web docs.
4. Re-run \`npx tsc --noEmit\` and \`npx vitest run\` via Bash to confirm green.
5. End with a 3-bullet summary: what broke, what you fixed, verification status.

Budget: be quick. Prefer small diffs. Do not refactor beyond the fix scope.
`.trim();

  let finalText = "";
  const tools: { name: string; input: unknown }[] = [];

  try {
    const q = query({
      prompt: briefing,
      options: {
        cwd: PROJECT,
        agent: "ares",
        agents: agentsMap as never,
        allowedTools: ["Bash", "Read", "Edit", "Write", "Grep", "Glob", "Agent"],
        permissionMode: "bypassPermissions",
        maxTurns: 25,
      },
    });

    for await (const message of q) {
      const m = message as {
        type: string;
        message?: {
          content?: Array<{ type: string; text?: string; name?: string; input?: unknown }>;
        };
        result?: string;
      };
      if (m.type === "assistant" && m.message?.content) {
        for (const block of m.message.content) {
          if (block.type === "text" && block.text) finalText += block.text;
          if (block.type === "tool_use" && block.name) tools.push({ name: block.name, input: block.input });
        }
      }
      if (m.type === "result") {
        finalText = m.result ?? finalText;
      }
    }
  } catch (e) {
    console.error("Autofix error:", e);
    return Response.json({ status: "error", message: "autofix failed" }, { status: 500 });
  }

  markFixed(now);

  return Response.json({
    status: "ran",
    fixedAt: Date.now(),
    bugsProcessed: bugs.length,
    toolsUsed: tools.length,
    summary: finalText.slice(0, 4000),
    signals: { tsClean, testsPass },
  });
}

export async function GET() {
  return Response.json({
    unfixed: unfixed().length,
    nextRun: "triggered via POST from the client-side hourly loop",
  });
}
