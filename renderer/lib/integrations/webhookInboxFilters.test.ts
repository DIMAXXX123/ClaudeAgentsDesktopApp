/**
 * webhookInboxFilters — unit tests
 *
 * Pure functions, no mocking needed.
 * Run: bun test lib/integrations/webhookInboxFilters.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  applyFilters,
  countBySource,
  createDefaultFilter,
  isFilterActive,
  resetFilter,
  setEventTypeQuery,
  setMinSizeBytes,
  setVerifiedOnly,
  toggleSource,
} from "./webhookInboxFilters";
import type { WebhookEvent } from "./webhookInbox";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEvent(overrides: Partial<WebhookEvent> = {}): WebhookEvent {
  return {
    id: `wh-${Math.random()}`,
    receivedAt: Date.now(),
    source: "generic",
    eventType: "push",
    method: "POST",
    headers: {},
    body: null,
    rawSize: 256,
    verified: null,
    ...overrides,
  };
}

const ghPush = makeEvent({ source: "github", eventType: "push", rawSize: 512, verified: true });
const ghRelease = makeEvent({ source: "github", eventType: "release", rawSize: 1024, verified: null });
const stripePay = makeEvent({ source: "stripe", eventType: "payment_intent.succeeded", rawSize: 2048, verified: false });
const tgMsg = makeEvent({ source: "telegram", eventType: "message", rawSize: 128, verified: null });
const generic = makeEvent({ source: "generic", eventType: "unknown", rawSize: 64, verified: null });

const ALL_EVENTS = [ghPush, ghRelease, stripePay, tgMsg, generic];

// ---------------------------------------------------------------------------
// createDefaultFilter / resetFilter
// ---------------------------------------------------------------------------

describe("createDefaultFilter", () => {
  it("creates an empty filter (no restrictions)", () => {
    const f = createDefaultFilter();
    expect(f.sources.size).toBe(0);
    expect(f.eventTypeQuery).toBe("");
    expect(f.verifiedOnly).toBeNull();
    expect(f.minSizeBytes).toBe(0);
  });
});

describe("resetFilter", () => {
  it("resets a modified filter back to defaults", () => {
    let f = createDefaultFilter();
    f = toggleSource(f, "github");
    f = setEventTypeQuery(f, "push");
    f = setVerifiedOnly(f, true);
    f = setMinSizeBytes(f, 1024);

    const reset = resetFilter();
    expect(reset.sources.size).toBe(0);
    expect(reset.eventTypeQuery).toBe("");
    expect(reset.verifiedOnly).toBeNull();
    expect(reset.minSizeBytes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// isFilterActive
// ---------------------------------------------------------------------------

describe("isFilterActive", () => {
  it("returns false for default filter", () => {
    expect(isFilterActive(createDefaultFilter())).toBe(false);
  });

  it("returns true when source filter set", () => {
    const f = toggleSource(createDefaultFilter(), "github");
    expect(isFilterActive(f)).toBe(true);
  });

  it("returns true when eventTypeQuery set", () => {
    const f = setEventTypeQuery(createDefaultFilter(), "push");
    expect(isFilterActive(f)).toBe(true);
  });

  it("returns true when whitespace-only query (trimmed = empty) returns false", () => {
    const f = setEventTypeQuery(createDefaultFilter(), "   ");
    expect(isFilterActive(f)).toBe(false);
  });

  it("returns true when verifiedOnly set", () => {
    const f = setVerifiedOnly(createDefaultFilter(), true);
    expect(isFilterActive(f)).toBe(true);
  });

  it("returns true when minSizeBytes > 0", () => {
    const f = setMinSizeBytes(createDefaultFilter(), 100);
    expect(isFilterActive(f)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// toggleSource
// ---------------------------------------------------------------------------

describe("toggleSource", () => {
  it("adds source to empty set", () => {
    const f = toggleSource(createDefaultFilter(), "github");
    expect(f.sources.has("github")).toBe(true);
    expect(f.sources.size).toBe(1);
  });

  it("removes source when already present", () => {
    let f = toggleSource(createDefaultFilter(), "github");
    f = toggleSource(f, "github");
    expect(f.sources.has("github")).toBe(false);
    expect(f.sources.size).toBe(0);
  });

  it("does not mutate the original filter", () => {
    const original = createDefaultFilter();
    toggleSource(original, "stripe");
    expect(original.sources.size).toBe(0); // immutable
  });

  it("can hold multiple sources", () => {
    let f = createDefaultFilter();
    f = toggleSource(f, "github");
    f = toggleSource(f, "stripe");
    expect(f.sources.size).toBe(2);
    expect(f.sources.has("github")).toBe(true);
    expect(f.sources.has("stripe")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — fast-path
// ---------------------------------------------------------------------------

describe("applyFilters (no-op when no filter active)", () => {
  it("returns the same array reference when filter is default", () => {
    const f = createDefaultFilter();
    const result = applyFilters(ALL_EVENTS, f);
    // Same reference (fast-path)
    expect(result).toBe(ALL_EVENTS);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — source
// ---------------------------------------------------------------------------

describe("applyFilters — source filter", () => {
  it("shows only github events when github selected", () => {
    const f = toggleSource(createDefaultFilter(), "github");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.source === "github")).toBe(true);
  });

  it("shows github + stripe when both toggled", () => {
    let f = createDefaultFilter();
    f = toggleSource(f, "github");
    f = toggleSource(f, "stripe");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(3);
  });

  it("shows all events when source set is empty", () => {
    const f = createDefaultFilter(); // empty set
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(ALL_EVENTS.length);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — event type query
// ---------------------------------------------------------------------------

describe("applyFilters — eventTypeQuery", () => {
  it("matches substring case-insensitively", () => {
    const f = setEventTypeQuery(createDefaultFilter(), "PUSH");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("push");
  });

  it("matches partial event type", () => {
    const f = setEventTypeQuery(createDefaultFilter(), "payment");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(1);
    expect(result[0].eventType).toBe("payment_intent.succeeded");
  });

  it("returns empty when query matches nothing", () => {
    const f = setEventTypeQuery(createDefaultFilter(), "nonexistent");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — verifiedOnly
// ---------------------------------------------------------------------------

describe("applyFilters — verifiedOnly", () => {
  it("shows only verified events when verifiedOnly=true", () => {
    const f = setVerifiedOnly(createDefaultFilter(), true);
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(1);
    expect(result[0].verified).toBe(true);
    expect(result[0].id).toBe(ghPush.id);
  });

  it("shows only explicitly unverified when verifiedOnly=false", () => {
    const f = setVerifiedOnly(createDefaultFilter(), false);
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(1);
    expect(result[0].verified).toBe(false);
    expect(result[0].id).toBe(stripePay.id);
  });

  it("shows all events when verifiedOnly=null", () => {
    const f = setVerifiedOnly(createDefaultFilter(), null);
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(ALL_EVENTS.length);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — minSizeBytes
// ---------------------------------------------------------------------------

describe("applyFilters — minSizeBytes", () => {
  it("excludes events smaller than threshold", () => {
    const f = setMinSizeBytes(createDefaultFilter(), 256);
    const result = applyFilters(ALL_EVENTS, f);
    // 128B telegram + 64B generic should be excluded
    expect(result.every((e) => e.rawSize >= 256)).toBe(true);
  });

  it("includes events exactly at threshold", () => {
    const f = setMinSizeBytes(createDefaultFilter(), 512);
    const result = applyFilters(ALL_EVENTS, f);
    const ids = result.map((e) => e.id);
    expect(ids).toContain(ghPush.id); // 512B
  });

  it("setMinSizeBytes clamps negative to 0", () => {
    const f = setMinSizeBytes(createDefaultFilter(), -100);
    expect(f.minSizeBytes).toBe(0);
    expect(isFilterActive(f)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// applyFilters — combined
// ---------------------------------------------------------------------------

describe("applyFilters — combined filters", () => {
  it("source + eventType narrows correctly", () => {
    let f = createDefaultFilter();
    f = toggleSource(f, "github");
    f = setEventTypeQuery(f, "push");
    const result = applyFilters(ALL_EVENTS, f);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ghPush.id);
  });

  it("source + minSize excludes small github events", () => {
    let f = createDefaultFilter();
    f = toggleSource(f, "github");
    f = setMinSizeBytes(f, 600);
    const result = applyFilters(ALL_EVENTS, f);
    // ghPush=512 excluded, ghRelease=1024 included
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(ghRelease.id);
  });
});

// ---------------------------------------------------------------------------
// countBySource
// ---------------------------------------------------------------------------

describe("countBySource", () => {
  it("counts correctly", () => {
    const counts = countBySource(ALL_EVENTS);
    expect(counts.github).toBe(2);
    expect(counts.stripe).toBe(1);
    expect(counts.telegram).toBe(1);
    expect(counts.generic).toBe(1);
    expect(counts.vercel).toBe(0);
    expect(counts.supabase).toBe(0);
  });

  it("returns zeros for empty list", () => {
    const counts = countBySource([]);
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });
});
