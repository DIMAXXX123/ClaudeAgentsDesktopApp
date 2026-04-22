"use client";

/**
 * PrefetchedQueryHints — NOVA pillar (components/search/)
 *
 * Renders predicted follow-up query chips below SearchPanel results.
 * Each chip fires the predicted query when clicked (via onSelect callback).
 *
 * Architecture — React 19 Activity API simulation:
 *   • A sentinel <div> is rendered *below* the visible results area.
 *   • usePrefetchedQueries attaches an IntersectionObserver to it with
 *     rootMargin="300px" — this means the prefetch fires when the sentinel
 *     is within 300px below the fold, i.e. *before* it becomes visible.
 *   • warmPrefetchCache() is called inside startTransition (low priority)
 *     → the batch /api/search/prefetch request fires without blocking paint.
 *   • Chips show a "cached" indicator (⚡) when results are already resolved.
 *
 * Usage:
 *   <PrefetchedQueryHints
 *     currentQuery={debouncedQuery}
 *     onSelect={(q) => setQuery(q)}
 *   />
 */

import clsx from "clsx";
import { usePrefetchedQueries } from "@/lib/search/usePrefetchedQueries";

// ── Props ─────────────────────────────────────────────────────────────────────

type Props = {
  /** The current NL query (debounced, from SearchPanel) */
  currentQuery: string;
  /** Called when user clicks a predicted query chip */
  onSelect: (query: string) => void;
  /** Recent query history for better predictions */
  history?: string[];
  /** Max chips to show (default 4) */
  maxPredictions?: number;
  /** Additional wrapper class */
  className?: string;
};

// ── Lightning bolt icon ────────────────────────────────────────────────────────

function BoltIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path d="M11.3 1.046A1 1 0 0 0 10 2v5H6a1 1 0 0 0-.8 1.6l7 9A1 1 0 0 0 14 17v-5h4a1 1 0 0 0 .8-1.6l-7-9a1 1 0 0 0-.5-.354z" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function PrefetchedQueryHints({
  currentQuery,
  onSelect,
  history        = [],
  maxPredictions = 4,
  className,
}: Props) {
  const { predictions, sentinelRef, prefetchFired } = usePrefetchedQueries(
    currentQuery,
    { history, maxPredictions, rootMargin: "300px" },
  );

  // Don't render anything when there's no query or no predictions
  if (!currentQuery.trim() || predictions.length === 0) {
    // Still render the sentinel so the observer fires when user scrolls
    return (
      <div
        ref={sentinelRef}
        aria-hidden
        className="h-px w-full pointer-events-none select-none"
        data-prefetch-sentinel="true"
      />
    );
  }

  return (
    <div className={clsx("flex flex-col gap-1.5", className)}>
      {/* Sentinel — placed at start so it's "behind" the results block */}
      <div
        ref={sentinelRef}
        aria-hidden
        className="h-px w-full pointer-events-none select-none"
        data-prefetch-sentinel="true"
      />

      {/* Section header */}
      <p className="flex items-center gap-1 text-[10px] text-white/25 uppercase tracking-widest select-none px-1">
        <span>Predicted queries</span>
        {prefetchFired && (
          <span
            title="Results prefetched in background"
            className="text-violet-400/50"
          >
            ·&nbsp;prefetched
          </span>
        )}
      </p>

      {/* Chips */}
      <div className="flex flex-wrap gap-1.5 px-1">
        {predictions.map(({ query, cached }) => (
          <button
            key={query}
            type="button"
            onClick={() => onSelect(query)}
            className={clsx(
              "inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-medium",
              "transition-all duration-150 cursor-pointer",
              "bg-white/5 border-white/10 text-white/50",
              "hover:bg-violet-500/15 hover:border-violet-500/40 hover:text-white/80",
              "active:scale-95",
            )}
            title={cached ? `${cached.length} results cached` : "Click to search"}
          >
            {/* Bolt icon when cached result is available */}
            {cached !== undefined && (
              <BoltIcon className="w-3 h-3 text-violet-400/60 shrink-0" />
            )}
            <span className="truncate max-w-[200px]">{query}</span>
            {cached !== undefined && (
              <span className="shrink-0 text-white/25 tabular-nums">{cached.length}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
