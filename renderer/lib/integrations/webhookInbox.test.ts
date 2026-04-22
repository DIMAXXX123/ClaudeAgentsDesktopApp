import { describe, it, expect, beforeEach } from "vitest";
import {
  appendEvent,
  getEvents,
  clearEvents,
  getEventById,
  detectSource,
  detectEventType,
  sanitizeHeaders,
} from "./webhookInbox";

// Reset store before each test
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
    // Newest first
    expect(events[0].source).toBe("stripe");
    expect(events[1].source).toBe("github");
  });

  it("limits returned events by limit param", () => {
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

  it("assigns unique ids", () => {
    appendEvent({
      receivedAt: 1,
      source: "generic",
      eventType: "a",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    appendEvent({
      receivedAt: 2,
      source: "generic",
      eventType: "b",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 0,
      verified: null,
    });
    const [ev2, ev1] = getEvents(2);
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
  it("returns the event with matching id", () => {
    const ev = appendEvent({
      receivedAt: 1,
      source: "github",
      eventType: "ping",
      method: "POST",
      headers: {},
      body: null,
      rawSize: 5,
      verified: null,
    });
    expect(getEventById(ev.id)).toEqual(ev);
  });

  it("returns undefined for unknown id", () => {
    expect(getEventById("nonexistent")).toBeUndefined();
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

  it("detects github via user-agent", () => {
    expect(detectSource({ "user-agent": "GitHub-Hookshot/abc123" })).toBe("github");
  });

  it("falls back to generic for unknown headers", () => {
    expect(detectSource({ "content-type": "application/json" })).toBe("generic");
  });
});

// ---------------------------------------------------------------------------
// Event type detection
// ---------------------------------------------------------------------------

describe("detectEventType", () => {
  it("returns x-github-event header for github", () => {
    expect(
      detectEventType("github", { "x-github-event": "pull_request" }, {})
    ).toBe("pull_request");
  });

  it("returns body.type for stripe", () => {
    expect(
      detectEventType("stripe", {}, { type: "customer.subscription.deleted" })
    ).toBe("customer.subscription.deleted");
  });

  it("reads event field from generic body", () => {
    expect(
      detectEventType("generic", {}, { event: "user.created" })
    ).toBe("user.created");
  });

  it("returns unknown when body is null", () => {
    expect(detectEventType("generic", {}, null)).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// sanitizeHeaders
// ---------------------------------------------------------------------------

describe("sanitizeHeaders", () => {
  it("redacts auth headers", () => {
    const result = sanitizeHeaders({
      authorization: "Bearer secret-token",
      "x-api-key": "sk-1234",
      "content-type": "application/json",
    });
    expect(result.authorization).toBe("[redacted]");
    expect(result["x-api-key"]).toBe("[redacted]");
    expect(result["content-type"]).toBe("application/json");
  });

  it("joins array header values with ', '", () => {
    const result = sanitizeHeaders({
      "accept-encoding": ["gzip", "deflate"],
    });
    expect(result["accept-encoding"]).toBe("gzip, deflate");
  });

  it("handles undefined values gracefully", () => {
    const result = sanitizeHeaders({ "x-custom": undefined });
    expect(result["x-custom"]).toBe("");
  });
});
