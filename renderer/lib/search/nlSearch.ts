/**
 * NL-search engine for NOVA pillar.
 * Scores MemoryNode[] (and optional ChatMessage[]) against a natural-language query.
 *
 * Design: pure functions, no I/O, no React → easy to test and import from API routes.
 */

import type { MemoryNode, NodeType } from "@/lib/memoryGalaxy";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChatSnippet = {
  agentId: string;
  agentName: string;
  role: "user" | "assistant";
  text: string;
  /** Unix ms */
  updatedAt: number;
};

export type SearchResultKind = "memory" | "chat";

export type SearchResult = {
  kind: SearchResultKind;
  id: string;
  name: string;
  type: NodeType | "chat";
  description: string;
  tags: string[];
  score: number;
  /** Matched tokens that contributed to the score */
  matchedTokens: string[];
};

export type SearchOptions = {
  /** Max results (default 20) */
  limit?: number;
  /**
   * Pre-filter by node types. Empty/undefined = all types.
   * Parsed from NL query if not supplied.
   */
  types?: NodeType[];
  /** Whether to search chats (default true) */
  includeChats?: boolean;
};

// ── NL keyword → NodeType mapping ─────────────────────────────────────────────

const NL_TYPE_MAP: Array<{ words: string[]; type: NodeType }> = [
  { words: ["skill", "skills"], type: "skill" },
  { words: ["agent", "agents"], type: "agent" },
  { words: ["hook", "hooks"], type: "hook" },
  { words: ["rule", "rules"], type: "rule" },
  { words: ["plan", "plans"], type: "plan" },
  { words: ["command", "commands", "cmd", "cmds"], type: "command" },
  { words: ["project", "projects"], type: "project" },
  { words: ["user", "users", "profile", "profiles"], type: "user" },
  { words: ["feedback"], type: "feedback" },
  { words: ["reference", "references", "ref", "refs", "docs"], type: "reference" },
  { words: ["index", "memory.md"], type: "index" },
  { words: ["style", "output-style", "formatting"], type: "output-style" },
  { words: ["claude-md", "claude.md", "claudemd"], type: "claude-md" },
  { words: ["plugin-skill"], type: "plugin-skill" },
  { words: ["plugin-command"], type: "plugin-command" },
  { words: ["plugin-agent"], type: "plugin-agent" },
];

// Verbs / prepositions that often precede the type hint but are noise
const STOP_WORDS = new Set([
  "show", "find", "search", "list", "get", "lookup", "about", "with", "for",
  "all", "my", "the", "a", "an", "in", "of", "on", "related", "containing",
  "called", "named", "and", "or", "not",
]);

// ── Tokeniser ─────────────────────────────────────────────────────────────────

/** Lowercases and splits on non-alphanumeric chars. Removes stop-words and 1-char tokens. */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// ── Type-hint detection ────────────────────────────────────────────────────────

/**
 * Extracts NodeType hints from the raw NL query string.
 * Returns [] if no type hint found (= search all types).
 */
export function detectTypeHints(query: string): NodeType[] {
  const lower = query.toLowerCase();
  const found: NodeType[] = [];
  for (const { words, type } of NL_TYPE_MAP) {
    if (words.some((w) => {
      const re = new RegExp(`(^|\\s|[^a-z])${w}(\\s|[^a-z]|$)`, "i");
      return re.test(lower);
    })) {
      if (!found.includes(type)) found.push(type);
    }
  }
  return found;
}

// ── Scoring ────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  nameExact: 12,
  nameToken: 5,
  tagToken: 3.5,
  descToken: 2,
  typeHintMatch: 2.0, // multiplier bonus when type matches hint
};

/** Compute [score, matchedTokens] for a MemoryNode given query tokens. */
export function scoreNode(
  node: MemoryNode,
  tokens: string[],
  typeHints: NodeType[],
): [number, string[]] {
  if (tokens.length === 0) return [0, []];

  const nameLower = node.name.toLowerCase();
  const descLower = node.description.toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  // Exact full-name match (bonus)
  const queryJoined = tokens.join(" ");
  if (nameLower === queryJoined || nameLower.includes(queryJoined)) {
    score += WEIGHTS.nameExact;
    tokens.forEach((t) => matched.add(t));
  }

  for (const tok of tokens) {
    // Name match
    if (nameLower.includes(tok)) {
      score += WEIGHTS.nameToken;
      matched.add(tok);
    }
    // Tag match
    if (node.tags.some((tag) => tag.includes(tok) || tok.includes(tag))) {
      score += WEIGHTS.tagToken;
      matched.add(tok);
    }
    // Description match
    if (descLower.includes(tok)) {
      score += WEIGHTS.descToken;
      matched.add(tok);
    }
  }

  // Type-hint multiplier
  if (typeHints.length > 0 && typeHints.includes(node.type)) {
    score *= WEIGHTS.typeHintMatch;
  }

  return [score, [...matched]];
}

/** Compute [score, matchedTokens] for a ChatSnippet. */
export function scoreChatSnippet(
  snippet: ChatSnippet,
  tokens: string[],
): [number, string[]] {
  if (tokens.length === 0) return [0, []];

  const nameLower = snippet.agentName.toLowerCase();
  const textLower = snippet.text.toLowerCase();
  const matched = new Set<string>();
  let score = 0;

  for (const tok of tokens) {
    if (nameLower.includes(tok)) { score += 2; matched.add(tok); }
    if (textLower.includes(tok)) { score += 1.5; matched.add(tok); }
  }

  return [score, [...matched]];
}

// ── Main entry point ───────────────────────────────────────────────────────────

/**
 * Search MemoryNodes (+ optional ChatSnippets) by NL query.
 * Returns results sorted by descending score, filtered by opts.
 */
export function nlSearch(
  nodes: MemoryNode[],
  query: string,
  chats: ChatSnippet[] = [],
  opts: SearchOptions = {},
): SearchResult[] {
  const limit = opts.limit ?? 20;
  const includeChats = opts.includeChats !== false;

  const tokens = tokenize(query);
  const autoTypeHints = detectTypeHints(query);
  const typeHints: NodeType[] = opts.types?.length ? opts.types : autoTypeHints;

  // Remove type-hint tokens from the scoring tokens list
  // so "show skills about testing" doesn't count "skill" as content match
  const typeWords = new Set(NL_TYPE_MAP.flatMap((e) => e.words));
  const contentTokens = tokens.filter((t) => !typeWords.has(t));
  // If all tokens are type words, use them all for content matching too
  const scoringTokens = contentTokens.length > 0 ? contentTokens : tokens;

  const results: SearchResult[] = [];

  // Score memory nodes
  for (const node of nodes) {
    // Pre-filter by type if hints resolved
    if (typeHints.length > 0 && !typeHints.includes(node.type)) continue;

    const [score, matchedTokens] = scoreNode(node, scoringTokens, typeHints);
    if (score <= 0 && scoringTokens.length > 0) continue;

    results.push({
      kind: "memory",
      id: node.id,
      name: node.name,
      type: node.type,
      description: node.description,
      tags: node.tags,
      score,
      matchedTokens,
    });
  }

  // Score chats
  if (includeChats) {
    for (const snippet of chats) {
      const [score, matchedTokens] = scoreChatSnippet(snippet, scoringTokens);
      if (score <= 0 && scoringTokens.length > 0) continue;
      results.push({
        kind: "chat",
        id: `chat:${snippet.agentId}:${snippet.updatedAt}`,
        name: snippet.agentName,
        type: "chat",
        description: snippet.text.slice(0, 200),
        tags: [],
        score,
        matchedTokens,
      });
    }
  }

  // Sort by descending score, then alphabetically for tie-breaking
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

// ── Highlight helper ──────────────────────────────────────────────────────────

/**
 * Returns the text with matched tokens wrapped in <mark>…</mark>.
 * Safe for React dangerouslySetInnerHTML (tokens are escaped).
 */
export function highlightTokens(text: string, tokens: string[]): string {
  if (tokens.length === 0) return text;
  const escaped = tokens
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return text;
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  return text.replace(re, "<mark>$1</mark>");
}
