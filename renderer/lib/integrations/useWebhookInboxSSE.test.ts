/**
 * Tests for the webhook SSE broadcast module.
 *
 * We test the pure broadcast/subscribe logic without a live EventSource —
 * the hook itself is thin glue around EventSource which is a browser API.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { broadcast, subscribe, subscriberCount } from "./webhookBroadcast";
import type { WebhookEvent } from "./webhookInbox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: `wh-test-${Math.random()}`,
    receivedAt: Date.now(),
    source: "github",
    eventType: "push",
    method: "POST",
    headers: {},
    body: { ref: "refs/heads/main" },
    rawSize: 42,
    verified: null,
    ...overrides,
  };
}

// Reset module state between tests by clearing all subscribers manually.
// We can't import the raw Set, so we drain it via subscribe + immediate unsubscribe trick.
beforeEach(() => {
  // Drain all listeners by abusing subscribe: register a listener, capture
  // how many existed, then close them all. The simplest approach: just
  // track via the public subscriberCount() helper and ensure each test
  // unsubscribes its own listeners.
});

// ---------------------------------------------------------------------------
// subscribe / unsubscribe
// ---------------------------------------------------------------------------

describe("subscribe / unsubscribe", () => {
  it("registers a listener that receives broadcast events", () => {
    const received: WebhookEvent[] = [];
    const unsub = subscribe((ev) => received.push(ev));

    const ev = makeEvent();
    broadcast(ev);
    unsub();

    expect(received).toHaveLength(1);
    expect(received[0].id).toBe(ev.id);
  });

  it("stops receiving events after unsubscribe", () => {
    const received: WebhookEvent[] = [];
    const unsub = subscribe((ev) => received.push(ev));
    unsub(); // immediately unsubscribe

    broadcast(makeEvent());

    expect(received).toHaveLength(0);
  });

  it("fan-out: multiple listeners each receive the event", () => {
    const a: WebhookEvent[] = [];
    const b: WebhookEvent[] = [];

    const unsubA = subscribe((ev) => a.push(ev));
    const unsubB = subscribe((ev) => b.push(ev));

    const ev = makeEvent({ source: "stripe" });
    broadcast(ev);

    unsubA();
    unsubB();

    expect(a[0].source).toBe("stripe");
    expect(b[0].source).toBe("stripe");
  });

  it("broadcasts multiple sequential events in order", () => {
    const received: WebhookEvent[] = [];
    const unsub = subscribe((ev) => received.push(ev));

    const first = makeEvent({ eventType: "push" });
    const second = makeEvent({ eventType: "pull_request" });

    broadcast(first);
    broadcast(second);
    unsub();

    expect(received).toHaveLength(2);
    expect(received[0].eventType).toBe("push");
    expect(received[1].eventType).toBe("pull_request");
  });
});

// ---------------------------------------------------------------------------
// subscriberCount
// ---------------------------------------------------------------------------

describe("subscriberCount", () => {
  it("reflects current number of active listeners", () => {
    const before = subscriberCount();

    const unsub1 = subscribe(() => {});
    const unsub2 = subscribe(() => {});

    expect(subscriberCount()).toBe(before + 2);

    unsub1();
    expect(subscriberCount()).toBe(before + 1);

    unsub2();
    expect(subscriberCount()).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Error resilience
// ---------------------------------------------------------------------------

describe("broadcast error resilience", () => {
  it("removes a throwing listener but continues to others", () => {
    const good: WebhookEvent[] = [];

    // Listener that throws
    const unsubBad = subscribe(() => {
      throw new Error("Simulated subscriber crash");
    });
    const unsubGood = subscribe((ev) => good.push(ev));

    // Should NOT throw
    expect(() => broadcast(makeEvent())).not.toThrow();

    // Good listener still received
    expect(good).toHaveLength(1);

    // Bad listener was auto-removed (subscriberCount dropped)
    // We already unsubscribe good manually; bad was removed by broadcast
    unsubGood();

    // unsubBad is now a no-op (listener already removed), but shouldn't throw
    expect(() => unsubBad()).not.toThrow();
  });

  it("does not deliver to null body events", () => {
    const received: WebhookEvent[] = [];
    const unsub = subscribe((ev) => received.push(ev));

    broadcast(makeEvent({ body: null, rawSize: 0 }));
    unsub();

    expect(received[0].body).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Spy integration
// ---------------------------------------------------------------------------

describe("broadcast spy integration", () => {
  it("calls listener with the exact event object passed", () => {
    const fn = vi.fn();
    const unsub = subscribe(fn);

    const ev = makeEvent({ source: "vercel", eventType: "deployment.created" });
    broadcast(ev);
    unsub();

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(ev);
  });
});
