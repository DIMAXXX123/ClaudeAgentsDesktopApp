"use client";

/**
 * SearchResults — NOVA pillar (components/search/)
 *
 * Renders a list of SearchResult[] from /api/search.
 * Highlights matched tokens, shows type badge and score.
 */

import clsx from "clsx";
import type { SearchResult } from "@/lib/search/nlSearch";
import { highlightTokens } from "@/lib/search/nlSearch";

// ── Type-badge colours ────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  skill:          "bg-violet-900/60 text-violet-300 border-violet-700",
  agent:          "bg-cyan-900/60   text-cyan-300   border-cyan-700",
  hook:           "bg-amber-900/60  text-amber-300  border-amber-700",
  rule:           "bg-emerald-900/60 text-emerald-300 border-emerald-700",
  plan:           "bg-blue-900/60   text-blue-300   border-blue-700",
  command:        "bg-rose-900/60   text-rose-300   border-rose-700",
  project:        "bg-indigo-900/60 text-indigo-300 border-indigo-700",
  reference:      "bg-slate-700/60  text-slate-300  border-slate-600",
  "output-style": "bg-pink-900/60   text-pink-300   border-pink-700",
  "claude-md":    "bg-orange-900/60 text-orange-300 border-orange-700",
  "plugin-skill": "bg-violet-800/60 text-violet-200 border-violet-600",
  chat:           "bg-teal-900/60   text-teal-300   border-teal-700",
};

function typeBadgeClass(type: string): string {
  return clsx(
    "px-1.5 py-0.5 rounded text-[10px] font-mono border shrink-0",
    TYPE_COLORS[type] ?? "bg-slate-700/60 text-slate-400 border-slate-600",
  );
}

// ── Highlight renderer ────────────────────────────────────────────────────────

function HighlightedText({ text, tokens }: { text: string; tokens: string[] }) {
  const html = highlightTokens(text, tokens);
  return (
    <span
      className="[&_mark]:bg-yellow-400/30 [&_mark]:text-yellow-200 [&_mark]:rounded-sm"
      // highlightTokens escapes regex chars; output only wraps existing text in <mark>
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

// ── Individual result row ─────────────────────────────────────────────────────

function ResultRow({
  result,
  onClick,
}: {
  result: SearchResult;
  onClick?: (r: SearchResult) => void;
}) {
  return (
    <li
      className={clsx(
        "flex flex-col gap-0.5 px-3 py-2 rounded-lg border border-white/5",
        "bg-white/4 hover:bg-white/8 transition-colors cursor-default",
        onClick && "cursor-pointer",
      )}
      onClick={() => onClick?.(result)}
    >
      <div className="flex items-center gap-2">
        <span className={typeBadgeClass(result.type)}>{result.type}</span>
        <span className="text-sm font-medium text-white truncate flex-1">
          <HighlightedText text={result.name} tokens={result.matchedTokens} />
        </span>
        {result.score > 0 && (
          <span className="text-[10px] text-white/30 shrink-0 tabular-nums">
            {result.score.toFixed(1)}
          </span>
        )}
      </div>
      {result.description && (
        <p className="text-xs text-white/50 line-clamp-2 pl-1">
          <HighlightedText text={result.description} tokens={result.matchedTokens} />
        </p>
      )}
      {result.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-1 pt-0.5">
          {result.tags.slice(0, 6).map((tag) => (
            <span key={tag} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/30">
              {tag}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export type SearchResultsMeta = {
  durationMs: number;
  nodeCount: number;
  resultCount: number;
  tokens: string[];
  autoTypeHints: string[];
};

export function SearchResults({
  results,
  meta,
  loading,
  error,
  onResultClick,
}: {
  results: SearchResult[];
  meta?: SearchResultsMeta;
  loading?: boolean;
  error?: string;
  onResultClick?: (r: SearchResult) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-white/40 animate-pulse">
        Searching memory galaxy…
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2 text-sm text-red-400 bg-red-900/20 rounded-lg border border-red-700/30">
        ⚠ {error}
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="py-6 text-center text-sm text-white/30">
        No results found
        {meta && meta.tokens.length > 0 && (
          <span className="block text-[11px] text-white/20 mt-1">
            tokens: {meta.tokens.join(", ")}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {meta && (
        <div className="px-1 pb-1 flex items-center justify-between text-[11px] text-white/25">
          <span>
            {meta.resultCount} result{meta.resultCount !== 1 ? "s" : ""}
            {meta.autoTypeHints.length > 0 && (
              <span className="ml-1 text-white/15">({meta.autoTypeHints.join(", ")})</span>
            )}
          </span>
          <span className="tabular-nums">{meta.durationMs}ms · {meta.nodeCount} nodes</span>
        </div>
      )}
      <ul className="flex flex-col gap-1">
        {results.map((r) => (
          <ResultRow key={r.id} result={r} onClick={onResultClick} />
        ))}
      </ul>
    </div>
  );
}
