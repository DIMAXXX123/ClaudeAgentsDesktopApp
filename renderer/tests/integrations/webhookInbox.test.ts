import { describe, it, expect, beforeEach } from "vitest";
import {
  appendEvent,
  getEvents,
  clearEvents,
  getEventById,
  detectSource,
  detectEventType,
  sanitizeHeaders,
} from "@/lib/integrations/webhookInbox";

beforeEach(() => {
  clearEvents();
});

// ---------------------------------------------------------------------------
// Store operations
// ---------------------------------------------------------------------------

describe("appendEvent / getEvents / clearEvents", () => {
  it("appends and retrieves events newest-first", () => {
    appendEvent({
      receivedAt: 1000,
      source: "github",
      eventType: "push",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    appendEvent({
      receivedAt: 2000,
      source: "stripe",
      eventType: "payment_intent.succeeded",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    const events = getEvents(10);
    expect(events).toHaveLength(2);
    expect(events[0].source).toBe("stripe");   // newest first
    expect(events[1].source).toBe("github");
  });

  it("respects the limit parameter", () => {
    for (let i = 0; i < 10; i++) {
      appendEvent({
        receivedAt: i,
        source: "generic",
        eventType: "test",
        method: "POST",
        headers: {},
        body: null,
        rawSize: 0,
        verified: null,
      });
    }
    expect(getEvents(3)).toHaveLength(3);
  });

  it("assigns unique ids to every event", () => {
    const ev1 = appendEvent({
      receivedAt: 1,
      source: "generic",
      eventType: "a",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    const ev2 = appendEvent({
      receivedAt: 2,
      source: "generic",
      eventType: "b",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    expect(ev1.id).not.toBe(ev2.id);
  });

  it("clearEvents empties the store", () => {
    appendEvent({
      receivedAt: 1,
      source: "generic",
      eventType: "x",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    clearEvents();
    expect(getEvents()).toHaveLength(0);
  });
});

describe("getEventById", () => {
  it("returns matching event", () => {
    const ev = appendEvent({
      receivedAt: 1,
      source: "github",
      eventType: "ping",
      method: "POST",
      headers: {},
      body: { zen: "Keep it simple." },
      rawSize: 20,
      verified: null,
    });
    expect(getEventById(ev.id)).toEqual(ev);
  });

  it("returns undefined for unknown id", () => {
    expect(getEventById("nonexistent-id")).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Source detection
// ---------------------------------------------------------------------------

describe("detectSource", () => {
  it("detects github via x-github-event header", () => {
    expect(detectSource({ "x-github-event": "push" })).toBe("github");
  });

  it("detects stripe via stripe-signature header", () => {
    expect(detectSource({ "stripe-signature": "t=xxx,v1=yyy" })).toBe("stripe");
  });

  it("detects vercel via x-vercel-signature header", () => {
    expect(detectSource({ "x-vercel-signature": "abc" })).toBe("vercel");
  });

  it("detects github via user-agent containing 'github'", () => {
    expect(detectSource({ "user-agent": "GitHub-Hookshot/abc123" })).toBe("github");
  });

  it("detects supabase via x-supabase-webhook-secret header", () => {
    expect(detectSource({ "x-supabase-webhook-secret": "secret" })).toBe("supabase");
  });

  it("falls back to generic for unknown headers", () => {
    expect(detectSource({ "content-type": "application/json" })).toBe("generic");
  });
});

// ---------------------------------------------------------------------------
// Event type detection
// ---------------------------------------------------------------------------

describe("detectEventType", () => {
  it("reads x-github-event header for github source", () => {
    expect(
      detectEventType("github", { "x-github-event": "pull_request" }, {})
    ).toBe("pull_request");
  });

  it("reads body.type for stripe source", () => {
    expect(
      detectEventType("stripe", {}, { type: "customer.subscription.deleted" })
    ).toBe("customer.subscription.deleted");
  });

  it("reads body.event for generic source", () => {
    expect(
      detectEventType("generic", {}, { event: "user.created" })
    ).toBe("user.created");
  });

  it("reads body.action for generic source when event is absent", () => {
    expect(
      detectEventType("generic", {}, { action: "opened" })
    ).toBe("opened");
  });

  it("returns 'unknown' when body is null", () => {
    expect(detectEventType("generic", {}, null)).toBe("unknown");
  });

  it("returns 'unknown' when body has no recognised type field", () => {
    expect(detectEventType("generic", {}, { foo: "bar" })).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// sanitizeHeaders
// ---------------------------------------------------------------------------

describe("sanitizeHeaders", () => {
  it("redacts authorization header", () => {
    const r = sanitizeHeaders({ authorization: "Bearer secret-token" });
    expect(r.authorization).toBe("[redacted]");
  });

  it("redacts x-api-key header", () => {
    const r = sanitizeHeaders({ "x-api-key": "sk-1234" });
    expect(r["x-api-key"]).toBe("[redacted]");
  });

  it("passes through non-sensitive headers unchanged", () => {
    const r = sanitizeHeaders({ "content-type": "application/json" });
    expect(r["content-type"]).toBe("application/json");
  });

  it("joins array values with ', '", () => {
    const r = sanitizeHeaders({ "accept-encoding": ["gzip", "deflate"] });
    expect(r["accept-encoding"]).toBe("gzip, deflate");
  });

  it("treats undefined values as empty string", () => {
    const r = sanitizeHeaders({ "x-custom": undefined });
    expect(r["x-custom"]).toBe("");
  });
});
