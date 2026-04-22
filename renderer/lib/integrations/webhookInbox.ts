/**
 * Webhook Inbox — in-memory store + parser for incoming webhook events.
 *
 * WHY in-memory: ULTRONOS is a local command station — a lightweight Map
 * ring-buffer is sufficient. No DB dep needed.
 * Max 200 events retained (oldest evicted automatically).
 */

export type WebhookSource =
  | "github"
  | "stripe"
  | "vercel"
  | "telegram"
  | "supabase"
  | "generic";

export interface WebhookEvent {
  id: string;
  receivedAt: number;         // Unix ms
  source: WebhookSource;
  eventType: string;          // e.g. "push", "payment_intent.succeeded"
  method: string;             // HTTP method of the incoming request
  headers: Record<string, string>;  // Sanitized subset (no auth tokens)
  body: unknown;              // Parsed JSON or raw string
  rawSize: number;            // bytes of original body
  /** HMAC verified (true) | not verified (false) | not attempted (null) */
  verified: boolean | null;
}

// ---------------------------------------------------------------------------
// Ring-buffer store (module singleton — persists across requests in same process)
// ---------------------------------------------------------------------------

const MAX_EVENTS = 200;
const store: WebhookEvent[] = [];
let idCounter = 0;

export function appendEvent(event: Omit<WebhookEvent, "id">): WebhookEvent {
  const ev: WebhookEvent = { id: `wh-${Date.now()}-${++idCounter}`, ...event };
  store.push(ev);
  if (store.length > MAX_EVENTS) store.splice(0, store.length - MAX_EVENTS);
  return ev;
}

/** Returns events newest-first, up to `limit`. */
export function getEvents(limit = 50): WebhookEvent[] {
  return [...store].reverse().slice(0, limit);
}

export function clearEvents(): void {
  store.splice(0, store.length);
}

export function getEventById(id: string): WebhookEvent | undefined {
  return store.find((e) => e.id === id);
}

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

export function detectSource(headers: Record<string, string>): WebhookSource {
  const ua = (headers["user-agent"] ?? "").toLowerCase();
  if (headers["x-github-event"] || ua.includes("github")) return "github";
  if (headers["stripe-signature"] || ua.includes("stripe")) return "stripe";
  if (headers["x-vercel-signature"] || ua.includes("vercel")) return "vercel";
  if (ua.includes("telegram")) return "telegram";
  if (headers["x-supabase-webhook-secret"] || ua.includes("supabase"))
    return "supabase";
  return "generic";
}

export function detectEventType(
  source: WebhookSource,
  headers: Record<string, string>,
  body: unknown
): string {
  if (source === "github") {
    return headers["x-github-event"] ?? "unknown";
  }
  if (source === "stripe") {
    return (body as { type?: string })?.type ?? "unknown";
  }
  if (source === "vercel") {
    return (body as { type?: string })?.type ?? "unknown";
  }
  if (source === "supabase") {
    return (body as { type?: string })?.type ?? "unknown";
  }
  // Generic: try common fields
  const b = body as Record<string, unknown> | null;
  if (b && typeof b === "object") {
    const type =
      (b.event as string) ??
      (b.type as string) ??
      (b.action as string) ??
      null;
    if (type) return String(type);
  }
  return "unknown";
}

// Strips sensitive header values (tokens, secrets, auth)
const SENSITIVE_HEADER_RE = /auth|secret|token|key|password|bearer/i;

export function sanitizeHeaders(
  raw: Record<string, string | string[] | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SENSITIVE_HEADER_RE.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Source badge colour helper (used by UI)
// ---------------------------------------------------------------------------

export const SOURCE_COLORS: Record<WebhookSource, string> = {
  github: "bg-gray-800 text-white",
  stripe: "bg-purple-700 text-white",
  vercel: "bg-black text-white",
  telegram: "bg-blue-500 text-white",
  supabase: "bg-green-700 text-white",
  generic: "bg-zinc-600 text-white",
};
