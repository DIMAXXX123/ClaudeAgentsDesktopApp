import { NextRequest } from "next/server";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { AGENTS } from "@/lib/agents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import path from "node:path";
import fs from "node:fs";
import os from "node:os";

function resolveSandbox(): string {
  const envSandbox = process.env.ULTRONOS_SANDBOX_DIR;
  if (envSandbox) return envSandbox;
  const dataDir = process.env.ULTRONOS_DATA_DIR;
  if (dataDir) {
    const p = path.join(dataDir, "sandbox");
    fs.mkdirSync(p, { recursive: true });
    return p;
  }
  return path.join(os.homedir(), "Documents", "claude-workspace", "ultronos-sandbox");
}

const SANDBOX = resolveSandbox();

function validateAgentId(id: string): boolean {
  const AGENT_IDS = new Set(Object.keys(AGENTS));
  return /^[a-z_]+$/.test(id) && AGENT_IDS.has(id);
}

function buildAgentsMap() {
  // Expose all 6 agents as subagents so ANY active agent can delegate via the Agent tool.
  const map: Record<string, {
    description: string;
    prompt: string;
    tools: string[];
  }> = {};
  for (const a of Object.values(AGENTS)) {
    map[a.id] = {
      description: a.description,
      prompt: a.systemPrompt,
      tools: a.allowedTools,
    };
  }
  return map;
}

type ClientEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_use"; name: string; input: unknown; id: string }
  | { type: "tool_result"; id: string; output: string; isError?: boolean }
  | { type: "done"; sessionId?: string; result?: string; error?: string }
  | { type: "error"; message: string };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    agentId: string;
    prompt: string;
    sessionId?: string;
    files?: Array<{ name: string; path?: string; base64?: string }>;
  };

  if (!validateAgentId(body.agentId)) {
    return new Response(
      JSON.stringify({ type: "error", message: "Invalid agent ID" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const agent = AGENTS[body.agentId]!;
  const agentsMap = buildAgentsMap();

  // Build file attachments if provided
  let promptWithFiles = body.prompt;
  if (body.files && body.files.length > 0) {
    const fileLines = body.files
      .map((f) => {
        if (f.path) return `- File: ${f.path} (${f.name})`;
        if (f.base64) return `- Image: ${f.name} (base64 embedded)`;
        return `- File: ${f.name}`;
      })
      .join("\n");
    promptWithFiles = `${body.prompt}\n\nAttached files:\n${fileLines}`;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ClientEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };

      try {
        const q = query({
          prompt: promptWithFiles,
          options: {
            cwd: SANDBOX,
            additionalDirectories: [
              path.join(os.homedir(), "Documents", "claude-workspace"),
              path.join(os.homedir(), "Documents"),
            ],
            agent: agent.id,
            agents: agentsMap as never,
            allowedTools: ["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
            resume: body.sessionId,
            maxTurns: 40,
          },
        });

        let sessionId: string | undefined;

        for await (const message of q) {
          const m = message as {
            type: string;
            session_id?: string;
            message?: {
              content?: Array<{
                type: string;
                text?: string;
                name?: string;
                input?: unknown;
                id?: string;
                tool_use_id?: string;
                content?: unknown;
                is_error?: boolean;
              }>;
            };
            result?: string;
            subtype?: string;
          };

          if (m.session_id) sessionId = m.session_id;

          if (m.type === "assistant" && m.message?.content) {
            for (const block of m.message.content) {
              if (block.type === "text" && block.text) {
                send({ type: "assistant_text", text: block.text });
              } else if (block.type === "tool_use" && block.name) {
                send({
                  type: "tool_use",
                  name: block.name,
                  input: block.input,
                  id: block.id ?? "",
                });
              }
            }
          } else if (m.type === "user" && m.message?.content) {
            for (const block of m.message.content) {
              if (block.type === "tool_result") {
                const content = block.content;
                const output =
                  typeof content === "string"
                    ? content
                    : Array.isArray(content)
                      ? content
                          .map((c: { type: string; text?: string }) =>
                            c.type === "text" ? (c.text ?? "") : "",
                          )
                          .join("\n")
                      : JSON.stringify(content);
                send({
                  type: "tool_result",
                  id: block.tool_use_id ?? "",
                  output: output.slice(0, 4000),
                  isError: block.is_error,
                });
              }
            }
          } else if (m.type === "result") {
            send({
              type: "done",
              sessionId,
              result: m.result,
              error: m.subtype && m.subtype !== "success" ? m.subtype : undefined,
            });
          }
        }

        controller.close();
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
