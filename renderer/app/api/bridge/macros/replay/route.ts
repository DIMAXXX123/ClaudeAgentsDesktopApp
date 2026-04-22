/**
 * /api/bridge/macros/replay — Server-side macro chain replay via SSE.
 *
 * POST { chain: MacroChain, speedFactor?: number }
 *
 * Streams replay events:
 *   { kind: "step-start",  index, step, totalSteps }
 *   { kind: "step-done",   index }
 *   { kind: "navigate",    agentId, prompt? }   ← client should open this agent
 *   { kind: "execute",     command }             ← client fires bridge command
 *   { kind: "done",        durationMs }
 *   { kind: "error",       message }
 *
 * The server handles timing + sequencing; the client acts on navigate/execute
 * events to produce visible effects without a second round-trip.
 *
 * speedFactor: 1.0 = real-time delays, 2.0 = 2× faster, 0 = instant.
 */

import { NextRequest } from "next/server";
import type { MacroChain, RecordedStep } from "@/lib/orchestration/macroRecorder";

export const runtime = "nodejs";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReplayEventKind =
  | "step-start"
  | "step-done"
  | "navigate"
  | "execute"
  | "done"
  | "error";

interface ReplayEvent {
  kind: ReplayEventKind;
  index?: number;
  step?: RecordedStep;
  totalSteps?: number;
  agentId?: string;
  prompt?: string;
  command?: string;
  durationMs?: number;
  message?: string;
}

// ── Validation ────────────────────────────────────────────────────────────────

function isValidChain(v: unknown): v is MacroChain {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.name === "string" &&
    Array.isArray(c.steps) &&
    typeof c.recordedAt === "number"
  );
}

function isValidStep(v: unknown): v is RecordedStep {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  const validKinds = ["open-agent", "send-prompt", "run-command"];
  return typeof s.kind === "string" && validKinds.includes(s.kind);
}

// ── SSE helper ─────────────────────────────────────────────────────────────────

function sse(event: ReplayEvent): string {
  return `event: replay\ndata: ${JSON.stringify(event)}\n\n`;
}

function tick(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Replay generator ──────────────────────────────────────────────────────────

async function* replayChain(
  chain: MacroChain,
  speedFactor: number,
): AsyncGenerator<ReplayEvent> {
  const t0 = Date.now();
  const steps = chain.steps.filter(isValidStep);

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];

    // Wait inter-step delay (scaled, capped at 4 s, skip if < 80 ms)
    if (speedFactor > 0) {
      const delay = Math.min(Math.round(step.delayMs / speedFactor), 4_000);
      if (delay > 80) {
        await tick(delay);
      }
    }

    // Announce step start
    yield { kind: "step-start", index: i, step, totalSteps: steps.length };

    // Emit actionable event the client should act on immediately
    if (step.kind === "open-agent" && step.agentId) {
      yield { kind: "navigate", index: i, agentId: step.agentId };
    } else if (step.kind === "send-prompt" && step.agentId) {
      yield { kind: "navigate", index: i, agentId: step.agentId, prompt: step.prompt };
    } else if (step.kind === "run-command" && step.command) {
      yield { kind: "execute", index: i, command: step.command };
    }

    // Brief pause before marking done
    await tick(60);
    yield { kind: "step-done", index: i };
  }

  yield { kind: "done", durationMs: Date.now() - t0 };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<Response> {
  let body: { chain: unknown; speedFactor?: unknown };
  try {
    body = (await req.json()) as { chain: unknown; speedFactor?: unknown };
  } catch {
    return new Response("invalid JSON", { status: 400 });
  }

  if (!isValidChain(body.chain)) {
    return new Response(
      JSON.stringify({ ok: false, error: "invalid chain shape" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const chain = body.chain;
  const rawSpeed = Number(body.speedFactor ?? 1);
  const speedFactor = Number.isFinite(rawSpeed) && rawSpeed >= 0 ? rawSpeed : 1;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const evt of replayChain(chain, speedFactor)) {
          controller.enqueue(encoder.encode(sse(evt)));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "replay failed";
        controller.enqueue(encoder.encode(sse({ kind: "error", message: msg })));
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

/**
 * GET /api/bridge/macros/replay — health check / list supported event kinds.
 */
export async function GET(): Promise<Response> {
  return Response.json({
    ok: true,
    description: "Macro chain replay SSE endpoint",
    events: ["step-start", "step-done", "navigate", "execute", "done", "error"],
    params: { speedFactor: "number (default 1.0, 0 = instant)" },
  });
}
