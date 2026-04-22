/**
 * webhookBroadcast — lightweight in-process pub/sub for SSE streaming.
 *
 * WHY: Next.js Route Handlers share the same Node.js process (in dev and
 * production). A module-level singleton can bridge the POST receiver and
 * any SSE subscribers without external infrastructure.
 *
 * Pattern: fan-out to registered ReadableStream controllers whenever a
 * new WebhookEvent arrives.
 */

import type { WebhookEvent } from "./webhookInbox";

type Listener = (ev: WebhookEvent) => void;

// Module-level singleton — survives across requests in the same process.
const listeners = new Set<Listener>();

/** Call this after appending a new event to the store. */
export function broadcast(ev: WebhookEvent): void {
  for (const fn of listeners) {
    try {
      fn(ev);
    } catch {
      // Subscriber threw — remove it silently (connection likely closed)
      listeners.delete(fn);
    }
  }
}

/** Register a listener. Returns an unsubscribe function. */
export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** How many active SSE subscribers are currently connected. */
export function subscriberCount(): number {
  return listeners.size;
}
