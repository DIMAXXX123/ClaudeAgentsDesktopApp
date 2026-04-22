/**
 * citationExtractor.ts — NOVA pillar (lib/search/)
 *
 * Given a MemoryNode and the query tokens that matched it, finds the
 * best-matching sentence(s) from the node description to surface as
 * inline source citations — equivalent to the "ranked passage retrieval"
 * step that follows a pgvector ANN search.
 *
 * Design: pure functions, no I/O, unit-testable.
 */

import type { MemoryNode } from "@/lib/memoryGalaxy";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Citation = {
  /** Stable source identifier — node.id (relative filepath) */
  source: string;
  /** Human-readable source label ("skill", "rule", "agent", …) */
  label: string;
  /** Best-matching excerpt from the node description (≤ 220 chars) */
  excerpt: string;
  /** Tokens from the original query that appear in this excerpt */
  matchedTokens: string[];
  /**
   * Passage-level similarity score ∈ [0, 1].
   * Computed as (matched token count) / (total query token count).
   * Approximates the cosine similarity a pgvector dense-embedding would return
   * for the same passage against the query embedding.
   */
  similarity: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_EXCERPT_CHARS = 220;
/** Minimum meaningful sentence length (chars) */
const MIN_SENTENCE_CHARS = 12;

// ── Sentence splitter ─────────────────────────────────────────────────────────

/**
 * Splits text into sentence-like chunks.
 * Handles: `.  !  ?  \n\n` as sentence terminators.
 * Returns only non-trivial chunks (≥ MIN_SENTENCE_CHARS chars).
 */
export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s{1,4}|(?:\n{2,})/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= MIN_SENTENCE_CHARS);
}

// ── Token-overlap scorer ──────────────────────────────────────────────────────

/**
 * Counts how many of `tokens` appear in `sentence` (case-insensitive).
 * Returns both the count and which tokens matched.
 */
function scorePassage(
  sentence: string,
  tokens: string[],
): { matchCount: number; matched: string[] } {
  const lower = sentence.toLowerCase();
  const matched = tokens.filter((t) => lower.includes(t));
  return { matchCount: matched.length, matched };
}

// ── Main extraction function ──────────────────────────────────────────────────

/**
 * Extract up to `maxCitations` inline source citations from a MemoryNode.
 *
 * Algorithm:
 *   1. Split node description into sentence-level passages.
 *   2. Score each passage by token overlap with the matched query tokens.
 *   3. Return top-k passages, each formatted as a Citation with:
 *      - excerpt (truncated to MAX_EXCERPT_CHARS)
 *      - similarity ∈ [0,1] (matched / total)
 *      - matchedTokens (which specific tokens appeared)
 *
 * Falls back to the raw description when no sentence-level split is possible.
 */
export function extractCitations(
  node: MemoryNode,
  matchedTokens: string[],
  maxCitations = 2,
): Citation[] {
  if (!node.description || matchedTokens.length === 0) {
    // No content or no tokens → return a minimal citation with empty similarity
    if (node.description) {
      return [
        {
          source: node.id,
          label: node.type,
          excerpt: node.description.slice(0, MAX_EXCERPT_CHARS),
          matchedTokens: [],
          similarity: 0,
        },
      ];
    }
    return [];
  }

  const sentences = splitSentences(node.description);

  if (sentences.length === 0) {
    // Description exists but has no splittable sentences — use raw
    const { matched } = scorePassage(node.description, matchedTokens);
    return [
      {
        source: node.id,
        label: node.type,
        excerpt: node.description.slice(0, MAX_EXCERPT_CHARS),
        matchedTokens: matched,
        similarity: matched.length / matchedTokens.length,
      },
    ];
  }

  // Score every sentence
  const scored = sentences
    .map((s) => {
      const { matchCount, matched } = scorePassage(s, matchedTokens);
      return { text: s, matchCount, matched };
    })
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  if (scored.length === 0) {
    // No sentence matched individual tokens — return first sentence as context
    return [
      {
        source: node.id,
        label: node.type,
        excerpt: sentences[0].slice(0, MAX_EXCERPT_CHARS),
        matchedTokens: [],
        similarity: 0,
      },
    ];
  }

  return scored.slice(0, maxCitations).map((s) => ({
    source: node.id,
    label: node.type,
    excerpt: s.text.slice(0, MAX_EXCERPT_CHARS),
    matchedTokens: s.matched,
    similarity: parseFloat((s.matchCount / matchedTokens.length).toFixed(4)),
  }));
}

// ── Similarity ranking helper ─────────────────────────────────────────────────

/**
 * Given an array of (result, citations) pairs, re-ranks the citations so that
 * the highest-similarity citation per result appears first.
 * This mirrors what pgvector's ORDER BY <=> does: sort by ascending distance.
 */
export function topCitation(citations: Citation[]): Citation | undefined {
  if (citations.length === 0) return undefined;
  return citations.reduce((best, c) => (c.similarity > best.similarity ? c : best));
}
