/**
 * /api/integrations/webhook-inbox
 *
 * POST  — receives ANY incoming webhook payload, stores it.
 * GET   — lists stored events (newest-first), optional ?limit=N.
 * DELETE — clears all events (dev convenience).
 *
 * Usage: point any external webhook at
 *   http://localhost:3000/api/integrations/webhook-inbox
 */

import { NextRequest, NextResponse } from "next/server";
import {
  appendEvent,
  getEvents,
  clearEvents,
  detectSource,
  detectEventType,
  sanitizeHeaders,
} from "@/lib/integrations/webhookInbox";
import { broadcast } from "@/lib/integrations/webhookBroadcast";

// ---------------------------------------------------------------------------
// POST — receive webhook
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest): Promise<NextResponse> {
  const rawHeaders: Record<string, string | undefined> = {};
  req.headers.forEach((value, key) => {
    rawHeaders[key] = value;
  });
  const sanitized = sanitizeHeaders(
    rawHeaders as Record<string, string | string[] | undefined>
  );

  // Parse body — tolerate non-JSON
  let body: unknown = null;
  let rawSize = 0;
  try {
    const text = await req.text();
    rawSize = new TextEncoder().encode(text).length;
    body = text ? JSON.parse(text) : null;
  } catch {
    body = await req.text().catch(() => null);
  }

  const source = detectSource(sanitized);
  const eventType = detectEventType(source, sanitized, body);

  const ev = appendEvent({
    receivedAt: Date.now(),
    source,
    eventType,
    method: req.method,
    headers: sanitized,
    body,
    rawSize,
    verified: null, // HMAC verification would require secret — not configured here
  });

  // Notify all active SSE subscribers immediately (zero-delay fan-out)
  broadcast(ev);

  return NextResponse.json({ ok: true, id: ev.id, source, eventType }, { status: 202 });
}

// ---------------------------------------------------------------------------
// GET — list events
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = new URL(req.url);
  const limit = Math.min(
    parseInt(url.searchParams.get("limit") ?? "50", 10),
    200
  );
  const events = getEvents(limit);
  return NextResponse.json({ events, count: events.length });
}

// ---------------------------------------------------------------------------
// DELETE — clear inbox (dev utility)
// ---------------------------------------------------------------------------
export async function DELETE(): Promise<NextResponse> {
  clearEvents();
  return NextResponse.json({ ok: true, message: "Inbox cleared." });
}
