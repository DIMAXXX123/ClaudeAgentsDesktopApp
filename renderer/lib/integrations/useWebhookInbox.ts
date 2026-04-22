/**
 * useWebhookInbox — polls /api/integrations/webhook-inbox and returns
 * live event list with actions.
 *
 * Polling instead of SSE: Next.js App Router makes SSE over Route Handlers
 * work but require more infra. Polling at 3s is fine for a local station.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WebhookEvent } from "./webhookInbox";

export type InboxState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; events: WebhookEvent[]; count: number; fetchedAt: number }
  | { status: "error"; message: string; fetchedAt: number };

interface Options {
  /** Polling interval ms. Default 3 000. Min 1 000. */
  intervalMs?: number;
  limit?: number;
  enabled?: boolean;
}

interface Actions {
  /** Manually re-fetch now. */
  refresh: () => void;
  /** DELETE /api/integrations/webhook-inbox then re-fetch. */
  clear: () => Promise<void>;
}

export function useWebhookInbox(
  { intervalMs = 3_000, limit = 50, enabled = true }: Options = {}
): InboxState & Actions {
  const [state, setState] = useState<InboxState>({ status: "idle" });
  const effectiveInterval = Math.max(intervalMs, 1_000);
  const abortRef = useRef<AbortController | null>(null);

  const doFetch = useCallback(
    async (signal?: AbortSignal) => {
      setState((prev) =>
        prev.status === "ok" ? prev : { status: "loading" }
      );
      try {
        const res = await fetch(
          `/api/integrations/webhook-inbox?limit=${limit}`,
          { signal }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          events: WebhookEvent[];
          count: number;
        };
        setState({
          status: "ok",
          events: data.events,
          count: data.count,
          fetchedAt: Date.now(),
        });
      } catch (err: unknown) {
        if ((err as { name?: string }).name === "AbortError") return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
          fetchedAt: Date.now(),
        });
      }
    },
    [limit]
  );

  const refresh = useCallback(() => {
    void doFetch();
  }, [doFetch]);

  const clear = useCallback(async () => {
    await fetch("/api/integrations/webhook-inbox", { method: "DELETE" });
    await doFetch();
  }, [doFetch]);

  useEffect(() => {
    if (!enabled) return;
    const ac = new AbortController();
    abortRef.current = ac;
    void doFetch(ac.signal);
    const id = setInterval(() => void doFetch(ac.signal), effectiveInterval);
    return () => {
      ac.abort();
      clearInterval(id);
    };
  }, [enabled, effectiveInterval, doFetch]);

  return { ...state, refresh, clear };
}
