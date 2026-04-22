/**
 * queryPredictor — NOVA pillar (lib/search/)
 *
 * Pure functions that predict likely follow-up NL queries given:
 *   - the current query string
 *   - optional history of recent queries
 *
 * Used by the prefetch layer to warm up /api/search results
 * before the user types them.
 *
 * Design: pure, no I/O, no React → safe to call from both server and client.
 */

import { tokenize, detectTypeHints } from "./nlSearch";
import type { NodeType } from "@/lib/memoryGalaxy";

// ── Query variant generators ──────────────────────────────────────────────────

/**
 * Type-expansion: if query has no explicit type hint, generate one variant
 * per common NodeType that adds that hint.
 */
const COMMON_TYPES: NodeType[] = ["skill", "agent", "hook", "rule", "plan", "project"];

function typeExpansionVariants(query: string): string[] {
  const hints = detectTypeHints(query);
  if (hints.length > 0) return []; // already typed, skip
  return COMMON_TYPES.map((t) => `${t}s related to ${query}`).slice(0, 3);
}

/**
 * Prefix-expansion: take the first meaningful token and generate "token …" variants
 * that prepend common qualifying words.
 */
const QUALIFIERS = ["how to", "list all", "show me"] as const;

function prefixExpansionVariants(query: string): string[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const root = tokens[0];
  return QUALIFIERS
    .filter((q) => !query.toLowerCase().startsWith(q))
    .map((q) => `${q} ${root}`)
    .slice(0, 2);
}

/**
 * Token-drop: remove the last token to get a broader query.
 * Useful when the user might want to widen the search.
 */
function tokenDropVariant(query: string): string[] {
  const tokens = tokenize(query);
  if (tokens.length < 2) return [];
  return [tokens.slice(0, -1).join(" ")];
}

/**
 * History-based: from recent query history, pick queries that share
 * at least one token with the current query and weren't the current one.
 */
function historyVariants(query: string, history: string[]): string[] {
  const tokens = new Set(tokenize(query));
  if (tokens.size === 0) return [];
  return history
    .filter((h) => h !== query)
    .filter((h) => tokenize(h).some((t) => tokens.has(t)))
    .slice(0, 2);
}

// ── De-duplication ────────────────────────────────────────────────────────────

function dedupe(queries: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const q of queries) {
    const key = q.trim().toLowerCase();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(q.trim());
    }
  }
  return out;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type PredictionOptions = {
  /** Recent query history (most-recent first) */
  history?: string[];
  /** Max predictions to return (default 5) */
  maxPredictions?: number;
};

/**
 * Predicts up to `maxPredictions` likely follow-up queries for the given input.
 * Returns an empty array when `query` is blank or too short.
 */
export function predictQueries(query: string, opts: PredictionOptions = {}): string[] {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const history = opts.history ?? [];
  const max     = opts.maxPredictions ?? 5;

  const candidates: string[] = [
    ...historyVariants(trimmed, history),
    ...tokenDropVariant(trimmed),
    ...prefixExpansionVariants(trimmed),
    ...typeExpansionVariants(trimmed),
  ];

  return dedupe(candidates).slice(0, max);
}

/**
 * Score a predicted query by how likely it is to yield useful results
 * (heuristic: more tokens + type hint = higher priority for prefetch).
 */
export function scorePrediction(predictedQuery: string): number {
  const tokens = tokenize(predictedQuery);
  const hints  = detectTypeHints(predictedQuery);
  return tokens.length * 1.0 + hints.length * 0.5;
}

/**
 * Returns predictions sorted by descending predicted-usefulness score.
 */
export function rankedPredictions(query: string, opts: PredictionOptions = {}): string[] {
  const preds = predictQueries(query, opts);
  return [...preds].sort((a, b) => scorePrediction(b) - scorePrediction(a));
}
