/**
 * useWebhookInboxSSE — real-time webhook event stream via SSE.
 *
 * Replaces polling with a persistent EventSource connection.
 * Falls back to "disconnected" state if SSE is unavailable (e.g. older env).
 *
 * Features:
 *  • Keeps a ring-buffer of up to MAX_LOCAL_EVENTS in client state
 *  • Tracks connection status ("connecting" | "open" | "closed" | "error")
 *  • Auto-reconnect: EventSource handles it natively
 *  • clear() flushes local state AND calls DELETE on the server
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebhookEvent } from "./webhookInbox";

const MAX_LOCAL_EVENTS = 100;

export type SSEConnectionStatus =
  | "connecting"
  | "open"
  | "closed"
  | "error"
  | "unsupported";

export interface WebhookInboxSSEState {
  events: WebhookEvent[];
  status: SSEConnectionStatus;
  subscriberCount: number | null;
  lastPingAt: number | null;
  errorMessage: string | null;
}

export interface WebhookInboxSSEActions {
  /** Remove all events from local state and issue DELETE to server. */
  clear: () => Promise<void>;
  /** Manually close and reopen the EventSource connection. */
  reconnect: () => void;
}

type UseWebhookInboxSSEResult = WebhookInboxSSEState & WebhookInboxSSEActions;

interface Options {
  /** Override SSE endpoint. Default: /api/integrations/webhook-inbox/stream */
  url?: string;
  /** Whether to mount the EventSource at all. Default true. */
  enabled?: boolean;
}

export function useWebhookInboxSSE(
  { url = "/api/integrations/webhook-inbox/stream", enabled = true }: Options = {}
): UseWebhookInboxSSEResult {
  const [state, setState] = useState<WebhookInboxSSEState>({
    events: [],
    status: "connecting",
    subscriberCount: null,
    lastPingAt: null,
    errorMessage: null,
  });

  const esRef = useRef<EventSource | null>(null);

  const openConnection = useCallback(() => {
    if (typeof window === "undefined" || !("EventSource" in window)) {
      setState((s) => ({ ...s, status: "unsupported" }));
      return;
    }

    // Close existing connection if any
    esRef.current?.close();

    setState((s) => ({ ...s, status: "connecting", errorMessage: null }));

    const es = new EventSource(url);
    esRef.current = es;

    es.addEventListener("connected", (e) => {
      const data = JSON.parse((e as MessageEvent).data ?? "{}") as {
        subscribers?: number;
      };
      setState((s) => ({
        ...s,
        status: "open",
        subscriberCount: data.subscribers ?? null,
        errorMessage: null,
      }));
    });

    es.addEventListener("webhook", (e) => {
      const ev = JSON.parse((e as MessageEvent).data) as WebhookEvent;
      setState((s) => ({
        ...s,
        events: [ev, ...s.events].slice(0, MAX_LOCAL_EVENTS),
      }));
    });

    es.addEventListener("ping", (e) => {
      const data = JSON.parse((e as MessageEvent).data ?? "{}") as {
        ts?: number;
      };
      setState((s) => ({ ...s, lastPingAt: data.ts ?? Date.now() }));
    });

    es.onerror = () => {
      // EventSource will auto-retry; we just mark status
      setState((s) => ({
        ...s,
        status: es.readyState === EventSource.CLOSED ? "closed" : "error",
        errorMessage:
          es.readyState === EventSource.CLOSED
            ? "Connection closed."
            : "Connection error — retrying…",
      }));
    };
  }, [url]);

  const reconnect = useCallback(() => {
    openConnection();
  }, [openConnection]);

  const clear = useCallback(async () => {
    // Flush local state immediately
    setState((s) => ({ ...s, events: [] }));
    // Then DELETE on server
    await fetch("/api/integrations/webhook-inbox", { method: "DELETE" });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    openConnection();
    return () => {
      esRef.current?.close();
      esRef.current = null;
    };
  }, [enabled, openConnection]);

  return { ...state, clear, reconnect };
}
