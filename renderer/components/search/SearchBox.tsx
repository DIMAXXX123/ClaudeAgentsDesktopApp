"use client";

/**
 * SearchBox — NOVA pillar (components/search/)
 *
 * Standalone NL-search widget. Debounces input, calls /api/search,
 * shows SearchResults inline. Drop-in anywhere in the ULTRONOS UI.
 *
 * Usage:
 *   <SearchBox placeholder="Search memory…" onResultClick={(r) => console.log(r)} />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { SearchResult } from "@/lib/search/nlSearch";
import { SearchResults } from "./SearchResults";
import type { SearchResultsMeta } from "./SearchResults";

// ── Types ─────────────────────────────────────────────────────────────────────

type SearchResponse = {
  ok: boolean;
  results?: SearchResult[];
  meta?: SearchResultsMeta;
  error?: string;
};

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchBox({
  placeholder = "Search memory galaxy…",
  limit = 20,
  debounceMs = 300,
  autofocus = false,
  className,
  onResultClick,
}: {
  placeholder?: string;
  /** Max results from API */
  limit?: number;
  /** Debounce delay ms (default 300) */
  debounceMs?: number;
  /** Auto-focus the input on mount */
  autofocus?: boolean;
  /** Additional CSS classes for the container */
  className?: string;
  /** Called when user clicks a result row */
  onResultClick?: (result: SearchResult) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [meta, setMeta] = useState<SearchResultsMeta | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [focused, setFocused] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const debouncedQuery = useDebounce(query.trim(), debounceMs);

  // Auto-focus
  useEffect(() => {
    if (autofocus) inputRef.current?.focus();
  }, [autofocus]);

  // Keyboard shortcut: Ctrl+/ or Cmd+/ to focus
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Fetch on debounced query change
  const fetchResults = useCallback(
    async (q: string) => {
      // Cancel previous request
      abortRef.current?.abort();

      if (!q) {
        setResults([]);
        setMeta(undefined);
        setError(undefined);
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setLoading(true);
      setError(undefined);

      try {
        const url = `/api/search?q=${encodeURIComponent(q)}&limit=${limit}`;
        const res = await fetch(url, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: SearchResponse = await res.json();
        if (!data.ok) throw new Error(data.error ?? "Search failed");
        setResults(data.results ?? []);
        setMeta(data.meta);
      } catch (err) {
        if ((err as Error).name === "AbortError") return; // silently ignore cancellation
        setError(err instanceof Error ? err.message : String(err));
        setResults([]);
        setMeta(undefined);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  const showPanel = focused && (loading || results.length > 0 || !!error || debouncedQuery.length > 0);

  return (
    <div className={clsx("relative w-full", className)}>
      {/* Input */}
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
          "bg-black/30 backdrop-blur-sm",
          focused
            ? "border-violet-500/60 ring-1 ring-violet-500/20"
            : "border-white/10 hover:border-white/20",
        )}
      >
        {/* Search icon */}
        <svg
          className="w-4 h-4 shrink-0 text-white/40"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className={clsx(
            "flex-1 bg-transparent text-sm text-white placeholder:text-white/30",
            "outline-none border-none",
          )}
          spellCheck={false}
          autoComplete="off"
        />

        {/* Clear button */}
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Clear search"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Shortcut hint */}
        {!query && !focused && (
          <kbd className="hidden sm:inline-flex shrink-0 items-center gap-0.5 text-[10px] text-white/20 font-mono">
            <span>⌃</span><span>/</span>
          </kbd>
        )}
      </div>

      {/* Results panel */}
      {showPanel && (
        <div
          className={clsx(
            "absolute left-0 right-0 mt-2 z-50",
            "rounded-xl border border-white/10 bg-black/80 backdrop-blur-md",
            "shadow-2xl shadow-black/60",
            "max-h-[60vh] overflow-y-auto p-2",
          )}
        >
          <SearchResults
            results={results}
            meta={meta}
            loading={loading}
            error={error}
            onResultClick={(r) => {
              onResultClick?.(r);
              setFocused(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
