"use client";

/**
 * SearchPanel — NOVA pillar (components/search/)
 *
 * Full NL-search results panel with:
 *   • Debounced query input (via /api/search)
 *   • Source-type filter chips (client-side multi-select)
 *   • Highlighted snippets (matchedTokens via highlightTokens)
 *   • Score display + timing meta
 *   • Keyboard shortcut Ctrl+/ to focus
 *
 * Usage:
 *   <SearchPanel />                                — standalone drop-in
 *   <SearchPanel limit={30} onResultClick={fn} />  — with overrides
 *
 * The panel manages its own query / filter state internally.
 * Parent only needs to handle `onResultClick` if desired.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import type { SearchResult } from "@/lib/search/nlSearch";
import { filterByTypes, toggleType } from "@/lib/search/filterChips";
import { FilterChips } from "./FilterChips";
import { SearchResults } from "./SearchResults";
import type { SearchResultsMeta } from "./SearchResults";

// ── API response type ─────────────────────────────────────────────────────────

type SearchApiResponse = {
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

// ── SearchIcon ────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SearchPanel({
  placeholder = "Search memory galaxy… (skills, agents, rules, …)",
  limit = 30,
  debounceMs = 280,
  autofocus = false,
  className,
  onResultClick,
}: {
  /** Input placeholder text */
  placeholder?: string;
  /** Max results returned from API */
  limit?: number;
  /** Input debounce delay in ms */
  debounceMs?: number;
  /** Auto-focus the input on mount */
  autofocus?: boolean;
  /** Additional wrapper CSS classes */
  className?: string;
  /** Optional handler when a result row is clicked */
  onResultClick?: (result: SearchResult) => void;
}) {
  // ── Query state ─────────────────────────────────────────────────────────────
  const [query, setQuery]       = useState("");
  const debouncedQuery          = useDebounce(query.trim(), debounceMs);

  // ── API state ───────────────────────────────────────────────────────────────
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [meta, setMeta]             = useState<SearchResultsMeta | undefined>();
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | undefined>();

  // ── Filter chips state ──────────────────────────────────────────────────────
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());

  // Reset filter when query changes (new search = fresh filter state)
  const prevQuery = useRef(debouncedQuery);
  useEffect(() => {
    if (debouncedQuery !== prevQuery.current) {
      prevQuery.current = debouncedQuery;
      setActiveTypes(new Set());
    }
  }, [debouncedQuery]);

  // ── Input focus state ───────────────────────────────────────────────────────
  const [focused, setFocused] = useState(false);
  const inputRef              = useRef<HTMLInputElement>(null);
  const abortRef              = useRef<AbortController | null>(null);

  // Auto-focus on mount
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

  // ── API fetch ───────────────────────────────────────────────────────────────
  const fetchResults = useCallback(
    async (q: string) => {
      abortRef.current?.abort();

      if (!q) {
        setAllResults([]);
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
        const data: SearchApiResponse = await res.json();
        if (!data.ok) throw new Error(data.error ?? "Search failed");
        setAllResults(data.results ?? []);
        setMeta(data.meta);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setAllResults([]);
        setMeta(undefined);
      } finally {
        setLoading(false);
      }
    },
    [limit],
  );

  useEffect(() => {
    void fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  // ── Derived filtered results ─────────────────────────────────────────────────
  const visibleResults = filterByTypes(allResults, activeTypes);

  // Build a meta override that reflects filtered count
  const visibleMeta: SearchResultsMeta | undefined = meta
    ? { ...meta, resultCount: visibleResults.length }
    : undefined;

  // ── Filter chip handlers ─────────────────────────────────────────────────────
  const handleToggle = useCallback((type: string) => {
    setActiveTypes((prev) => toggleType(prev, type));
  }, []);

  const handleClear = useCallback(() => {
    setActiveTypes(new Set());
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────
  const hasContent = loading || allResults.length > 0 || !!error || debouncedQuery.length > 0;

  return (
    <div className={clsx("flex flex-col gap-3 w-full", className)}>
      {/* ── Query input ─────────────────────────────────────────────────────── */}
      <div
        className={clsx(
          "flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
          "bg-black/30 backdrop-blur-sm",
          focused
            ? "border-violet-500/60 ring-1 ring-violet-500/20"
            : "border-white/10 hover:border-white/20",
        )}
      >
        <SearchIcon className="w-4 h-4 shrink-0 text-white/40" />

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none border-none"
          spellCheck={false}
          autoComplete="off"
          aria-label="Search memory galaxy"
        />

        {/* Loading spinner */}
        {loading && (
          <span className="shrink-0 w-3.5 h-3.5 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin" aria-label="Searching…" />
        )}

        {/* Clear button */}
        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setActiveTypes(new Set());
              inputRef.current?.focus();
            }}
            className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Clear search"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}

        {/* Keyboard hint */}
        {!query && !focused && (
          <kbd className="hidden sm:inline-flex shrink-0 items-center gap-0.5 text-[10px] text-white/20 font-mono" aria-label="Keyboard shortcut Control slash">
            <span>⌃</span><span>/</span>
          </kbd>
        )}
      </div>

      {/* ── Content area (chips + results) ─────────────────────────────────── */}
      {hasContent && (
        <div className="flex flex-col gap-2">
          {/* Filter chips — only when we have multi-type results */}
          {!loading && allResults.length > 0 && (
            <FilterChips
              results={allResults}
              activeTypes={activeTypes}
              onToggle={handleToggle}
              onClear={handleClear}
              className="px-1"
            />
          )}

          {/* Filter indicator — show when a type filter is active */}
          {activeTypes.size > 0 && (
            <p className="px-1 text-[11px] text-white/25 tabular-nums">
              Showing {visibleResults.length} of {allResults.length} results
              {" "}(filtered by {Array.from(activeTypes).join(", ")})
            </p>
          )}

          {/* Results */}
          <SearchResults
            results={visibleResults}
            meta={visibleMeta}
            loading={loading}
            error={error}
            onResultClick={(r) => {
              onResultClick?.(r);
            }}
          />
        </div>
      )}

      {/* ── Empty state (no query yet) ──────────────────────────────────────── */}
      {!hasContent && (
        <p className="px-2 text-[12px] text-white/20 text-center py-4 select-none">
          Type to search skills, agents, hooks, rules, plans, projects…
        </p>
      )}
    </div>
  );
}
