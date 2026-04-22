/**
 * GET /api/integrations/webhook-inbox/stream
 *
 * Server-Sent Events endpoint — pushes webhook events to the browser
 * the instant they arrive, without polling.
 *
 * Event format:
 *   event: webhook
 *   data: <JSON-serialised WebhookEvent>
 *
 * Connection lifecycle:
 *   • Client connects → receives a synthetic "connected" ping
 *   • Each POST to /api/integrations/webhook-inbox fans-out here instantly
 *   • Client disconnect triggers cleanup via the AbortSignal
 *
 * Browser usage:
 *   const es = new EventSource('/api/integrations/webhook-inbox/stream');
 *   es.addEventListener('webhook', e => { const ev = JSON.parse(e.data); });
 *   es.addEventListener('ping', () => {}); // heartbeat every 25 s
 */

import type { NextRequest } from "next/server";
import { subscribe, subscriberCount } from "@/lib/integrations/webhookBroadcast";
import type { WebhookEvent } from "@/lib/integrations/webhookInbox";

export const runtime = "nodejs"; // ReadableStream + setInterval need Node runtime

const HEARTBEAT_INTERVAL_MS = 25_000; // keep connection alive through proxies

function sseChunk(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const { signal } = req;

  let unsubscribe: (() => void) | null = null;
  let heartbeatId: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();

      const enqueue = (chunk: string) => {
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          // Controller closed — teardown handled by cancel()
        }
      };

      // Initial ping — confirms the stream is open
      enqueue(
        sseChunk(
          "connected",
          JSON.stringify({ subscribers: subscriberCount() + 1 })
        )
      );

      // Subscribe to new events
      unsubscribe = subscribe((ev: WebhookEvent) => {
        enqueue(sseChunk("webhook", JSON.stringify(ev)));
      });

      // Heartbeat — prevents idle-timeout on load balancers / Vercel
      heartbeatId = setInterval(() => {
        enqueue(sseChunk("ping", `{"ts":${Date.now()}}`));
      }, HEARTBEAT_INTERVAL_MS);

      // Cleanup when the client disconnects
      signal.addEventListener("abort", () => {
        unsubscribe?.();
        unsubscribe = null;
        if (heartbeatId !== null) {
          clearInterval(heartbeatId);
          heartbeatId = null;
        }
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },

    cancel() {
      unsubscribe?.();
      unsubscribe = null;
      if (heartbeatId !== null) {
        clearInterval(heartbeatId);
        heartbeatId = null;
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // CORS — allow same-origin (no wildcard needed for local station)
      "X-Accel-Buffering": "no", // disable nginx buffering
    },
  });
}
