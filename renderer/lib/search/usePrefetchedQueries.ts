/**
 * usePrefetchedQueries — NOVA pillar (lib/search/)
 *
 * React 19-style prefetch hook for predicted NL queries.
 *
 * Technique mirrors the React 19 Activity API's "hidden prerender behind
 * current viewport" intent:
 *   1. IntersectionObserver with a large rootMargin fires when the sentinel
 *      element is *approaching* viewport (or is off-screen below it).
 *   2. On first intersection startTransition fires warmPrefetchCache() so
 *      the browser issues the batch request at low priority.
 *   3. Resolved results land in the module-level promise cache, ready for
 *      React 19 use(Promise) suspension in PrefetchedQueryHints.
 *
 * "use client" — this module is client-only.
 */

"use client";

import { useCallback, useEffect, useRef, startTransition } from "react";
import { rankedPredictions }  from "./queryPredictor";
import { warmPrefetchCache, peekCachedResult } from "./prefetchCache";
import type { PrefetchResult }                  from "./prefetchCache";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UsePrefetchedQueriesOptions = {
  /** Query history for prediction context (most-recent first) */
  history?: string[];
  /** Max predictions to generate and prefetch */
  maxPredictions?: number;
  /**
   * rootMargin for IntersectionObserver — how far below the fold the sentinel
   * can be before we trigger the prefetch.
   * Default: "300px" (starts prefetch when sentinel is 300px below viewport).
   */
  rootMargin?: string;
  /** Enable/disable prefetch entirely (e.g. when SSR) */
  enabled?: boolean;
};

export type PrefetchedQuery = {
  query:     string;
  /** Available immediately if promise already resolved */
  cached:    PrefetchResult | undefined;
};

export type UsePrefetchedQueriesReturn = {
  /** Predicted queries + any synchronously available cached results */
  predictions:     PrefetchedQuery[];
  /** Ref to attach to a sentinel <div> placed below the search results */
  sentinelRef:     React.RefObject<HTMLDivElement | null>;
  /** Whether the prefetch batch request has been triggered */
  prefetchFired:   boolean;
  /** Manually fire the prefetch (useful for testing or eager loading) */
  firePrefetch:    () => void;
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePrefetchedQueries(
  currentQuery: string,
  opts: UsePrefetchedQueriesOptions = {},
): UsePrefetchedQueriesReturn {
  const {
    history        = [],
    maxPredictions = 5,
    rootMargin     = "300px",
    enabled        = true,
  } = opts;

  const sentinelRef    = useRef<HTMLDivElement | null>(null);
  const prefiredRef    = useRef(false);
  const lastQueryRef   = useRef<string>("");

  // Derive predictions (pure, cheap — runs every render)
  const predictions: PrefetchedQuery[] = enabled && currentQuery.trim().length >= 2
    ? rankedPredictions(currentQuery, { history, maxPredictions }).map((q) => ({
        query:  q,
        cached: peekCachedResult(q),
      }))
    : [];

  // Fire prefetch via startTransition so React schedules it at low priority
  const firePrefetch = useCallback(() => {
    if (!enabled || currentQuery.trim().length < 2) return;
    const queries = rankedPredictions(currentQuery, { history, maxPredictions });
    if (queries.length === 0) return;
    startTransition(() => {
      warmPrefetchCache(queries);
    });
    prefiredRef.current = true;
  }, [currentQuery, history, maxPredictions, enabled]);

  // Reset fired flag when query changes significantly
  useEffect(() => {
    if (lastQueryRef.current !== currentQuery) {
      lastQueryRef.current = currentQuery;
      prefiredRef.current  = false;
    }
  }, [currentQuery]);

  // IntersectionObserver on the sentinel element
  useEffect(() => {
    if (!enabled || typeof IntersectionObserver === "undefined") return;

    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Fires when sentinel enters the extended rootMargin zone
        if (entry.isIntersecting && !prefiredRef.current) {
          firePrefetch();
        }
      },
      {
        root:       null, // viewport
        rootMargin: `0px 0px ${rootMargin} 0px`, // expand below viewport
        threshold:  0,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, firePrefetch, rootMargin]);

  return {
    predictions,
    sentinelRef,
    prefetchFired: prefiredRef.current,
    firePrefetch,
  };
}
