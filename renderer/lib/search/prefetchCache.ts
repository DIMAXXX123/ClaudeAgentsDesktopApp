/**
 * prefetchCache — NOVA pillar (lib/search/)
 *
 * Module-level promise cache for React 19's `use(Promise)` pattern.
 *
 * Why module-level?
 *   React 19 `use(promise)` suspends on the SAME promise reference.
 *   If we create a new Promise each render the component never unsuspends.
 *   A stable module-level Map<query, Promise> fixes this.
 *
 * Usage:
 *   // Prime the cache (call from IntersectionObserver / off-viewport effect):
 *   warmPrefetchCache(["skills for testing", "list all agents"]);
 *
 *   // Consume in a component (must be inside Suspense):
 *   const results = use(getPrefetchPromise("skills for testing"));
 */

import type { SearchResult } from "./nlSearch";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PrefetchResult = SearchResult[];

export type PrefetchApiResponse = {
  ok:      boolean;
  results: Record<string, SearchResult[]>;
  error?:  string;
};

// ── Module-level promise store ─────────────────────────────────────────────────

const cache = new Map<string, Promise<PrefetchResult>>();

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchBatch(queries: string[]): Promise<Record<string, PrefetchResult>> {
  const res = await fetch("/api/search/prefetch", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ queries, limit: 10 }),
  });
  if (!res.ok) return {};
  const data: PrefetchApiResponse = await res.json() as PrefetchApiResponse;
  return data.ok ? data.results : {};
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Primes the cache for each query that isn't already cached.
 * Fires a single batch request for all missing queries.
 * Safe to call multiple times — cached queries are not refetched.
 */
export function warmPrefetchCache(queries: string[]): void {
  const missing = queries.filter((q) => q.trim() && !cache.has(q.trim()));
  if (missing.length === 0) return;

  // Create a shared batch promise
  const batchPromise = fetchBatch(missing);

  // Give each missing query its own promise slice
  for (const q of missing) {
    cache.set(
      q.trim(),
      batchPromise.then((batch) => batch[q] ?? []),
    );
  }
}

/**
 * Returns the stable Promise for a query that can be passed to React 19's `use()`.
 * Returns null if not yet primed — call warmPrefetchCache first.
 */
export function getPrefetchPromise(query: string): Promise<PrefetchResult> | null {
  return cache.get(query.trim()) ?? null;
}

/**
 * Reads a cached result synchronously (resolved value).
 * Uses the Promise inspection trick: attaches a `.then` that writes to a sync ref.
 * Returns undefined if not yet resolved.
 */
export function peekCachedResult(query: string): PrefetchResult | undefined {
  const key = query.trim();
  const p = cache.get(key);
  if (!p) return undefined;

  // Attach a tag object to extract the resolved value synchronously
  const tagged = p as Promise<PrefetchResult> & {
    _cachedValue?: PrefetchResult;
    _resolved?:    boolean;
  };

  if (tagged._resolved) return tagged._cachedValue;

  void p.then((v) => {
    tagged._resolved    = true;
    tagged._cachedValue = v;
  });

  return undefined;
}

/**
 * Clears the entire cache (useful on query reset or logout).
 */
export function clearPrefetchCache(): void {
  cache.clear();
}

/**
 * Returns the number of currently cached entries.
 */
export function prefetchCacheSize(): number {
  return cache.size;
}
