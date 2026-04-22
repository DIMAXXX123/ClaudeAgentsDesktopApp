/**
 * filterChips.ts — NOVA pillar (lib/search/)
 *
 * Pure utility functions for source-type filter chips in the NL-search panel.
 * No React, no I/O — pure functions so they're trivially testable.
 */

import type { NodeType } from "@/lib/memoryGalaxy";
import type { SearchResult, SearchResultKind } from "@/lib/search/nlSearch";

// ── Source-type catalog ───────────────────────────────────────────────────────

/**
 * All filter chip types, ordered by importance for display.
 * "chat" corresponds to SearchResultKind == "chat".
 * All others map to MemoryNode type strings.
 */
export const FILTER_CHIP_TYPES: Array<NodeType | "chat"> = [
  "skill",
  "agent",
  "command",
  "hook",
  "rule",
  "plan",
  "project",
  "reference",
  "output-style",
  "claude-md",
  "plugin-skill",
  "plugin-command",
  "plugin-agent",
  "user",
  "feedback",
  "index",
  "chat",
];

/** Human-readable label for each source type */
export const FILTER_CHIP_LABELS: Record<NodeType | "chat" | "unknown", string> = {
  skill:          "Skills",
  agent:          "Agents",
  command:        "Commands",
  hook:           "Hooks",
  rule:           "Rules",
  plan:           "Plans",
  project:        "Projects",
  reference:      "References",
  "output-style": "Styles",
  "claude-md":    "Claude.md",
  "plugin-skill": "Plugin Skills",
  "plugin-command": "Plugin Cmds",
  "plugin-agent": "Plugin Agents",
  user:           "Users",
  feedback:       "Feedback",
  index:          "Index",
  chat:           "Chat",
  unknown:        "Unknown",
};

// ── Pure utility functions ────────────────────────────────────────────────────

/** Count results per type (type → count). Only types with count > 0 are included. */
export function countByType(results: SearchResult[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const r of results) {
    const key = r.type as string;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Filter SearchResult[] by active type set.
 * If `activeTypes` is empty, returns all results (no filter applied).
 */
export function filterByTypes(
  results: SearchResult[],
  activeTypes: ReadonlySet<string>,
): SearchResult[] {
  if (activeTypes.size === 0) return results;
  return results.filter((r) => activeTypes.has(r.type as string));
}

/**
 * Toggle a type in the active set.
 * If already active → remove it.
 * If not active → add it.
 * Returns a new Set (immutable update).
 */
export function toggleType(
  activeTypes: ReadonlySet<string>,
  type: string,
): Set<string> {
  const next = new Set(activeTypes);
  if (next.has(type)) {
    next.delete(type);
  } else {
    next.add(type);
  }
  return next;
}

/**
 * Return only the types that have at least one result, in display order.
 * Used to decide which chips to show.
 */
export function activeChipTypes(
  results: SearchResult[],
): Array<NodeType | "chat"> {
  const counts = countByType(results);
  return FILTER_CHIP_TYPES.filter((t) => (counts.get(t) ?? 0) > 0);
}

/** Given the current activeTypes and a result, return if it passes the filter. */
export function resultPassesFilter(
  result: SearchResult,
  activeTypes: ReadonlySet<string>,
): boolean {
  return activeTypes.size === 0 || activeTypes.has(result.type as string);
}
