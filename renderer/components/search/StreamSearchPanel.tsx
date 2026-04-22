"use client";

/**
 * StreamSearchPanel — NOVA pillar (components/search/)
 *
 * Full NL-search panel backed by the SSE streaming endpoint
 * /api/search/stream. Results appear progressively as the server
 * emits them (one result per SSE frame), each annotated with inline
 * source citations and a pgvector-style similarity badge.
 *
 * Features:
 *   • Debounced query input (280 ms)
 *   • Progressive result disclosure via ReadableStream / EventSource
 *   • Inline source citations per result (extracted server-side)
 *   • pgSimilarity badge (normalised [0,1], coloured by threshold)
 *   • Matched-token highlighting via <mark>
 *   • Ctrl+/ keyboard shortcut to focus
 *   • Accessible: role="status" live region for screen-readers
 *
 * Usage:
 *   <StreamSearchPanel />
 *   <StreamSearchPanel limit={30} onResultClick={fn} />
 */

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { highlightTokens } from "@/lib/search/nlSearch";
import type { StreamResult, StreamMeta } from "@/app/api/search/stream/route";

// ── Debounce hook ─────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
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

function CitationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
    </svg>
  );
}

// ── Similarity badge ──────────────────────────────────────────────────────────

function SimilarityBadge({ score }: { score: number }) {
  const pct   = Math.round(score * 100);
  const color =
    score >= 0.8 ? "text-emerald-400 border-emerald-500/30 bg-emerald-950/40" :
    score >= 0.5 ? "text-yellow-400 border-yellow-500/30 bg-yellow-950/40"   :
                   "text-white/40 border-white/10 bg-white/5";

  return (
    <span
      className={clsx(
        "inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border",
        color,
      )}
      title={`pgvector similarity: ${score.toFixed(4)}`}
    >
      {pct}%
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  skill:          "text-violet-400 bg-violet-950/50 border-violet-500/20",
  agent:          "text-blue-400 bg-blue-950/50 border-blue-500/20",
  hook:           "text-orange-400 bg-orange-950/50 border-orange-500/20",
  rule:           "text-yellow-400 bg-yellow-950/50 border-yellow-500/20",
  plan:           "text-cyan-400 bg-cyan-950/50 border-cyan-500/20",
  command:        "text-green-400 bg-green-950/50 border-green-500/20",
  reference:      "text-pink-400 bg-pink-950/50 border-pink-500/20",
  "plugin-skill": "text-fuchsia-400 bg-fuchsia-950/50 border-fuchsia-500/20",
  chat:           "text-slate-400 bg-slate-950/50 border-slate-500/20",
};

function TypeBadge({ type }: { type: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border",
        TYPE_COLORS[type] ?? "text-white/40 bg-white/5 border-white/10",
      )}
    >
      {type}
    </span>
  );
}

// ── Citation row ──────────────────────────────────────────────────────────────

function CitationRow({
  excerpt,
  source,
  matchedTokens,
  similarity,
}: {
  excerpt: string;
  source: string;
  matchedTokens: string[];
  similarity: number;
}) {
  const highlighted = highlightTokens(excerpt, matchedTokens);
  const filename    = source.split("/").pop() ?? source;

  return (
    <div className="mt-1.5 flex gap-2 items-start pl-3 border-l border-white/10">
      <CitationIcon className="w-3 h-3 shrink-0 mt-0.5 text-white/25" />
      <div className="flex flex-col gap-0.5 min-w-0">
        {/* Source label */}
        <span className="text-[10px] text-white/30 font-mono truncate" title={source}>
          {filename}
          {similarity > 0 && (
            <span className="ml-1.5 text-white/20">
              ({Math.round(similarity * 100)}% match)
            </span>
          )}
        </span>
        {/* Excerpt with highlighted tokens */}
        <p
          className="text-[11px] text-white/50 leading-relaxed line-clamp-2"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>
    </div>
  );
}

// ── Result row ────────────────────────────────────────────────────────────────

function ResultRow({
  result,
  onResultClick,
  animating,
}: {
  result: StreamResult;
  onResultClick?: (r: StreamResult) => void;
  animating: boolean;
}) {
  const highlightedName = highlightTokens(result.name, result.matchedTokens);
  const highlightedDesc = highlightTokens(result.description, result.matchedTokens);

  return (
    <div
      role="listitem"
      className={clsx(
        "flex flex-col gap-1 px-3 py-2.5 rounded-lg border cursor-pointer select-none transition-all duration-200",
        "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.12]",
        animating && "animate-in fade-in slide-in-from-bottom-1 duration-200",
      )}
      onClick={() => onResultClick?.(result)}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 min-w-0">
        {/* Rank */}
        <span className="shrink-0 text-[10px] font-mono text-white/20 tabular-nums w-4 text-right">
          {result.rank}
        </span>

        {/* Name */}
        <span
          className="flex-1 text-sm font-medium text-white/90 truncate"
          dangerouslySetInnerHTML={{ __html: highlightedName }}
        />

        {/* Badges */}
        <div className="shrink-0 flex items-center gap-1.5">
          <SimilarityBadge score={result.pgSimilarity} />
          <TypeBadge type={result.type} />
        </div>
      </div>

      {/* Description */}
      {result.description && (
        <p
          className="text-xs text-white/45 line-clamp-1 leading-relaxed pl-6"
          dangerouslySetInnerHTML={{ __html: highlightedDesc }}
        />
      )}

      {/* Inline citations */}
      {result.citations.length > 0 && (
        <div className="pl-6 flex flex-col gap-1">
          {result.citations.map((c, i) => (
            <CitationRow
              key={`${c.source}-${i}`}
              excerpt={c.excerpt}
              source={c.source}
              matchedTokens={c.matchedTokens}
              similarity={c.similarity}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StreamSearchPanel({
  placeholder = "Stream-search memory… (skills, agents, rules, …)",
  limit = 20,
  debounceMs = 280,
  autofocus = false,
  className,
  onResultClick,
}: {
  placeholder?: string;
  limit?: number;
  debounceMs?: number;
  autofocus?: boolean;
  className?: string;
  onResultClick?: (result: StreamResult) => void;
}) {
  const [query, setQuery]       = useState("");
  const debouncedQuery          = useDebounce(query.trim(), debounceMs);

  const [results, setResults]   = useState<StreamResult[]>([]);
  const [meta, setMeta]         = useState<StreamMeta | undefined>();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | undefined>();
  const [focused, setFocused]   = useState(false);
  /** Track which result indices were just streamed in (for animation) */
  const [newIndexes, setNewIndexes] = useState<Set<number>>(new Set());

  const inputRef  = useRef<HTMLInputElement>(null);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // Auto-focus
  useEffect(() => {
    if (autofocus) inputRef.current?.focus();
  }, [autofocus]);

  // Keyboard shortcut Ctrl+/ or Cmd+/
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

  // ── SSE consumer ───────────────────────────────────────────────────────────

  const cancelStream = useCallback(() => {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
  }, []);

  const startStream = useCallback(
    async (q: string) => {
      cancelStream();

      if (!q) {
        setResults([]);
        setMeta(undefined);
        setError(undefined);
        return;
      }

      setLoading(true);
      setError(undefined);
      setResults([]);
      setMeta(undefined);
      setNewIndexes(new Set());

      try {
        const url  = `/api/search/stream?q=${encodeURIComponent(q)}&limit=${limit}`;
        const resp = await fetch(url);

        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        readerRef.current = reader;

        const decoder = new TextDecoder();
        let buffer    = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE frames from buffer
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";

          for (const frame of frames) {
            if (!frame.trim()) continue;

            let eventName = "message";
            let dataLine  = "";

            for (const line of frame.split("\n")) {
              if (line.startsWith("event: ")) eventName = line.slice(7).trim();
              if (line.startsWith("data: "))  dataLine  = line.slice(6).trim();
            }

            if (!dataLine) continue;

            try {
              const payload = JSON.parse(dataLine) as unknown;

              if (eventName === "result") {
                const r = payload as StreamResult;
                setResults((prev) => {
                  const idx = prev.length;
                  setNewIndexes((s) => new Set([...s, idx]));
                  // Clear animation flag after transition
                  setTimeout(() => {
                    setNewIndexes((s) => {
                      const next = new Set(s);
                      next.delete(idx);
                      return next;
                    });
                  }, 400);
                  return [...prev, r];
                });
              } else if (eventName === "meta") {
                setMeta(payload as StreamMeta);
                setLoading(false);
              } else if (eventName === "error") {
                const { message } = payload as { message: string };
                setError(message);
                setLoading(false);
              } else if (eventName === "done") {
                setLoading(false);
              }
            } catch {
              // Malformed JSON frame — skip
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    },
    [limit, cancelStream],
  );

  useEffect(() => {
    void startStream(debouncedQuery);
    return cancelStream;
  }, [debouncedQuery, startStream, cancelStream]);

  // ── Render ────────────────────────────────────────────────────────────────

  const isEmpty = !loading && results.length === 0 && !error && !debouncedQuery;

  return (
    <div className={clsx("flex flex-col gap-3 w-full", className)}>
      {/* ── Input ──────────────────────────────────────────────────────────── */}
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
          aria-label="Stream search memory galaxy"
        />

        {loading && (
          <span
            className="shrink-0 w-3.5 h-3.5 rounded-full border-2 border-violet-500/40 border-t-violet-400 animate-spin"
            aria-label="Streaming results…"
          />
        )}

        {query && !loading && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              cancelStream();
              setResults([]);
              setMeta(undefined);
              inputRef.current?.focus();
            }}
            className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Clear search"
          >
            <XIcon className="w-4 h-4" />
          </button>
        )}

        {!query && !focused && (
          <kbd className="hidden sm:inline-flex shrink-0 items-center gap-0.5 text-[10px] text-white/20 font-mono" aria-label="Keyboard shortcut Control slash">
            <span>⌃</span><span>/</span>
          </kbd>
        )}
      </div>

      {/* ── Meta strip ─────────────────────────────────────────────────────── */}
      {meta && (
        <div className="flex items-center gap-3 px-1 text-[11px] text-white/25 tabular-nums">
          <span>{meta.resultCount} results</span>
          <span>·</span>
          <span>{meta.durationMs} ms</span>
          {meta.autoTypeHints.length > 0 && (
            <>
              <span>·</span>
              <span>types: {meta.autoTypeHints.join(", ")}</span>
            </>
          )}
          {/* SSE stream badge */}
          <span className="ml-auto inline-flex items-center gap-1 text-violet-400/60">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500/60 animate-pulse" />
            stream
          </span>
        </div>
      )}

      {/* ── Error ──────────────────────────────────────────────────────────── */}
      {error && (
        <p className="px-3 py-2 rounded-lg bg-red-950/40 border border-red-500/20 text-red-400 text-xs">
          {error}
        </p>
      )}

      {/* ── Results list ───────────────────────────────────────────────────── */}
      {results.length > 0 && (
        <div
          role="list"
          aria-label="Search results"
          aria-live="polite"
          aria-atomic="false"
          className="flex flex-col gap-1.5"
        >
          {results.map((r, i) => (
            <ResultRow
              key={r.id}
              result={r}
              onResultClick={onResultClick}
              animating={newIndexes.has(i)}
            />
          ))}
        </div>
      )}

      {/* ── Loading skeleton (first load before any results arrive) ────────── */}
      {loading && results.length === 0 && (
        <div className="flex flex-col gap-1.5" aria-label="Loading results">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-14 rounded-lg bg-white/[0.03] border border-white/[0.05] animate-pulse"
              style={{ opacity: 1 - i * 0.25 }}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ─────────────────────────────────────────────────────── */}
      {isEmpty && (
        <p className="px-2 text-[12px] text-white/20 text-center py-4 select-none">
          Stream-search skills, agents, hooks, rules, plans…
          <br />
          <span className="text-[10px] text-white/15">results appear as they arrive · with inline citations</span>
        </p>
      )}

      {/* ── No results (query ran, nothing matched) ─────────────────────────── */}
      {!loading && !error && results.length === 0 && debouncedQuery.length > 0 && (
        <p className="px-2 text-[12px] text-white/25 text-center py-3 select-none">
          No results for <span className="text-white/40">"{debouncedQuery}"</span>
        </p>
      )}
    </div>
  );
}
