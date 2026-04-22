/**
 * webhookInboxFilters — pure filter logic for the live webhook event log.
 *
 * Kept separate from the store so the UI can apply filters client-side
 * without re-fetching. All functions are pure / referentially transparent —
 * easy to unit-test and safe to call in render.
 */

import type { WebhookEvent, WebhookSource } from "./webhookInbox";

// ---------------------------------------------------------------------------
// Filter state
// ---------------------------------------------------------------------------

export interface WebhookFilterState {
  /** Which sources to show. Empty set = no restriction (show all). */
  sources: Set<WebhookSource>;
  /** Case-insensitive substring match on ev.eventType. Empty = no filter. */
  eventTypeQuery: string;
  /**
   * Verification gate:
   *   null  → show all
   *   true  → show only HMAC-verified
   *   false → show only explicitly unverified (ev.verified === false)
   */
  verifiedOnly: boolean | null;
  /** Minimum raw body size in bytes. 0 = no lower bound. */
  minSizeBytes: number;
}

// ---------------------------------------------------------------------------
// Factory / reset
// ---------------------------------------------------------------------------

export function createDefaultFilter(): WebhookFilterState {
  return {
    sources: new Set<WebhookSource>(),
    eventTypeQuery: "",
    verifiedOnly: null,
    minSizeBytes: 0,
  };
}

export function resetFilter(): WebhookFilterState {
  return createDefaultFilter();
}

// ---------------------------------------------------------------------------
// Mutations (return new state — treat filter as immutable)
// ---------------------------------------------------------------------------

/**
 * Toggle a source in/out of the active set.
 * Removing the last source effectively resets the source filter (show all).
 */
export function toggleSource(
  filter: WebhookFilterState,
  source: WebhookSource
): WebhookFilterState {
  const next = new Set(filter.sources);
  if (next.has(source)) {
    next.delete(source);
  } else {
    next.add(source);
  }
  return { ...filter, sources: next };
}

export function setEventTypeQuery(
  filter: WebhookFilterState,
  query: string
): WebhookFilterState {
  return { ...filter, eventTypeQuery: query };
}

export function setVerifiedOnly(
  filter: WebhookFilterState,
  verifiedOnly: boolean | null
): WebhookFilterState {
  return { ...filter, verifiedOnly };
}

export function setMinSizeBytes(
  filter: WebhookFilterState,
  bytes: number
): WebhookFilterState {
  return { ...filter, minSizeBytes: Math.max(0, bytes) };
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Returns true when at least one filter constraint is active. */
export function isFilterActive(filter: WebhookFilterState): boolean {
  return (
    filter.sources.size > 0 ||
    filter.eventTypeQuery.trim().length > 0 ||
    filter.verifiedOnly !== null ||
    filter.minSizeBytes > 0
  );
}

// ---------------------------------------------------------------------------
// Core: apply all active filters to an event list
// ---------------------------------------------------------------------------

export function applyFilters(
  events: WebhookEvent[],
  filter: WebhookFilterState
): WebhookEvent[] {
  // Fast-path — nothing active
  if (!isFilterActive(filter)) return events;

  const query = filter.eventTypeQuery.trim().toLowerCase();

  return events.filter((ev) => {
    // --- Source ---
    if (filter.sources.size > 0 && !filter.sources.has(ev.source)) {
      return false;
    }

    // --- Event type ---
    if (query && !ev.eventType.toLowerCase().includes(query)) {
      return false;
    }

    // --- Verification ---
    if (filter.verifiedOnly === true && ev.verified !== true) {
      return false;
    }
    if (filter.verifiedOnly === false && ev.verified !== false) {
      return false;
    }

    // --- Min size ---
    if (filter.minSizeBytes > 0 && ev.rawSize < filter.minSizeBytes) {
      return false;
    }

    return true;
  });
}

// ---------------------------------------------------------------------------
// Stat helpers — useful for filter summary badges
// ---------------------------------------------------------------------------

/** Returns event counts broken down by source, for the given list. */
export function countBySource(
  events: WebhookEvent[]
): Record<WebhookSource, number> {
  const counts: Record<WebhookSource, number> = {
    github: 0,
    stripe: 0,
    vercel: 0,
    telegram: 0,
    supabase: 0,
    generic: 0,
  };
  for (const ev of events) {
    counts[ev.source] = (counts[ev.source] ?? 0) + 1;
  }
  return counts;
}
