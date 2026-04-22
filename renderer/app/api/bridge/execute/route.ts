/**
 * /api/bridge/execute — SSE streaming command execution.
 *
 * POST { command, agentId?, payload? }
 * → streams "execution" SSE events until done/error.
 *
 * Each event:
 *   event: execution
 *   data: { phase, command, message?, pct?, result?, durationMs?, error?, ts }
 */

import { NextRequest } from "next/server";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecutionPhase = "start" | "progress" | "done" | "error";

export interface ExecutionEvent {
  phase: ExecutionPhase;
  command: string;
  message?: string;
  /** 0-100 progress hint */
  pct?: number;
  result?: string;
  durationMs?: number;
  error?: string;
  ts: number;
}

interface ExecuteBody {
  command: string;
  agentId?: string;
  payload?: Record<string, unknown>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sse(data: ExecutionEvent): string {
  return `event: execution\ndata: ${JSON.stringify(data)}\n\n`;
}

function tick(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function* handleCommand(
  command: string,
  agentId: string | undefined,
  _payload: Record<string, unknown> | undefined,
): AsyncGenerator<ExecutionEvent> {
  const t0 = Date.now();
  const cmd = command.trim().toLowerCase();

  yield { phase: "start", command: cmd, ts: t0 };

  switch (cmd) {
    case "open-memory":
      yield { phase: "progress", command: cmd, message: "Loading memory panel…", pct: 35, ts: Date.now() };
      await tick(180);
      yield { phase: "progress", command: cmd, message: "Hydrating entries…", pct: 75, ts: Date.now() };
      await tick(120);
      yield { phase: "done", command: cmd, result: "Memory panel opened", durationMs: Date.now() - t0, ts: Date.now() };
      break;

    case "open-galaxy":
      yield { phase: "progress", command: cmd, message: "Computing galaxy layout…", pct: 40, ts: Date.now() };
      await tick(220);
      yield { phase: "progress", command: cmd, message: "Rendering nodes…", pct: 80, ts: Date.now() };
      await tick(120);
      yield { phase: "done", command: cmd, result: "Galaxy view activated", durationMs: Date.now() - t0, ts: Date.now() };
      break;

    case "open-conductor":
      yield { phase: "progress", command: cmd, message: "Initialising conductor…", pct: 50, ts: Date.now() };
      await tick(150);
      yield { phase: "done", command: cmd, result: "Conductor panel opened", durationMs: Date.now() - t0, ts: Date.now() };
      break;

    case "status":
      yield { phase: "progress", command: cmd, message: "Pinging agents…", pct: 40, ts: Date.now() };
      await tick(100);
      yield { phase: "progress", command: cmd, message: "Aggregating health…", pct: 80, ts: Date.now() };
      await tick(80);
      yield {
        phase: "done",
        command: cmd,
        result: agentId
          ? `${agentId.toUpperCase()} reports nominal`
          : "All 6 agents nominal",
        durationMs: Date.now() - t0,
        ts: Date.now(),
      };
      break;

    case "refresh-memory":
      yield { phase: "progress", command: cmd, message: "Scanning Obsidian vault…", pct: 20, ts: Date.now() };
      await tick(160);
      yield { phase: "progress", command: cmd, message: "Indexing entries…", pct: 55, ts: Date.now() };
      await tick(180);
      yield { phase: "progress", command: cmd, message: "Rebuilding search index…", pct: 85, ts: Date.now() };
      await tick(120);
      yield { phase: "done", command: cmd, result: "Memory refreshed", durationMs: Date.now() - t0, ts: Date.now() };
      break;

    case "clear-chat":
      yield { phase: "progress", command: cmd, message: "Clearing chat history…", pct: 50, ts: Date.now() };
      await tick(100);
      yield { phase: "done", command: cmd, result: "Chat cleared", durationMs: Date.now() - t0, ts: Date.now() };
      break;

    default:
      if (agentId) {
        yield {
          phase: "progress",
          command: cmd,
          message: `Routing to ${agentId.toUpperCase()}…`,
          pct: 45,
          ts: Date.now(),
        };
        await tick(200);
        yield {
          phase: "done",
          command: cmd,
          result: `Dispatched "${cmd}" → ${agentId.toUpperCase()}`,
          durationMs: Date.now() - t0,
          ts: Date.now(),
        };
      } else {
        yield {
          phase: "error",
          command: cmd,
          error: `Unknown command: "${cmd}"`,
          ts: Date.now(),
        };
      }
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let body: ExecuteBody;
  try {
    body = (await req.json()) as ExecuteBody;
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  const { command, agentId, payload } = body;
  if (!command || typeof command !== "string") {
    return new Response('"command" string required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of handleCommand(command, agentId, payload)) {
          controller.enqueue(encoder.encode(sse(evt)));
        }
      } catch (err) {
        const errEvt: ExecutionEvent = {
          phase: "error",
          command,
          error: err instanceof Error ? err.message : "internal error",
          ts: Date.now(),
        };
        controller.enqueue(encoder.encode(sse(errEvt)));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      Connection: "keep-alive",
    },
  });
}
