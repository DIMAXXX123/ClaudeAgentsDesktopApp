/**
 * macroLibrary — unified macro library merging keybinding macros and
 * recorded macro chains into a single searchable collection.
 *
 * Provides:
 *   - MacroLibraryEntry  — tagged union of { kind: "macro" } | { kind: "chain" }
 *   - buildLibrary()     — merges macroStore + macroRecorder into flat list
 *   - searchLibrary()    — fuzzy-ranked entries by keyword query
 *   - replayChainSSE()   — SSE-based replay helper returning an AsyncGenerator
 *
 * Designed for CommandPaletteV2's MACROS tab: one search box covers both
 * keyboard shortcuts and recorded action sequences.
 */

import type { Macro } from "@/lib/orchestration/macroStore";
import type { MacroChain, ReplayStepEvent } from "@/lib/orchestration/macroRecorder";
import { fuzzyFilter, type FuzzyResult } from "@/lib/orchestration/fuzzySearch";

// ── Entry types ───────────────────────────────────────────────────────────────

export interface MacroEntry {
  kind: "macro";
  macro: Macro;
}

export interface ChainEntry {
  kind: "chain";
  chain: MacroChain;
}

export type MacroLibraryEntry = MacroEntry | ChainEntry;

// ── Searchable key extraction ─────────────────────────────────────────────────

function entryKeys(e: MacroLibraryEntry): string[] {
  if (e.kind === "macro") {
    const m = e.macro;
    const actionLabel =
      m.action.type === "open-agent"
        ? m.action.agentId
        : m.action.type === "send-prompt"
          ? `${m.action.agentId} ${m.action.prompt}`
          : m.action.command;
    return [m.name, m.keybinding, actionLabel];
  }
  // chain
  const c = e.chain;
  const stepLabels = c.steps
    .map((s) =>
      s.kind === "open-agent"
        ? (s.agentId ?? "")
        : s.kind === "send-prompt"
          ? `${s.agentId ?? ""} ${s.prompt ?? ""}`
          : (s.command ?? ""),
    )
    .join(" ");
  return [c.name, stepLabels];
}

// ── Build / search ────────────────────────────────────────────────────────────

/**
 * Merge keybinding macros and recorded chains into a single ordered list.
 * Chains come first (most-recently-recorded first), then macros.
 */
export function buildLibrary(macros: Macro[], chains: MacroChain[]): MacroLibraryEntry[] {
  const chainEntries: ChainEntry[] = chains.map((chain) => ({ kind: "chain", chain }));
  const macroEntries: MacroEntry[] = macros.map((macro) => ({ kind: "macro", macro }));
  return [...chainEntries, ...macroEntries];
}

/**
 * Search the library with a fuzzy query.
 * Returns entries sorted by descending relevance score.
 * Empty query → original order (score 0 for all).
 */
export function searchLibrary(
  macros: Macro[],
  chains: MacroChain[],
  query: string,
): FuzzyResult<MacroLibraryEntry>[] {
  const entries = buildLibrary(macros, chains);
  return fuzzyFilter(entries, query, entryKeys);
}

// ── SSE replay helper ─────────────────────────────────────────────────────────

/**
 * All events that can arrive from the /api/bridge/macros/replay SSE stream.
 * Superset of macroRecorder's ReplayStepEvent — the SSE route also emits
 * navigate and execute events that the client must handle.
 */
export type ReplaySseEvent = ReplayStepEvent;

/**
 * Stream a macro chain replay from the server.
 *
 * Yields ReplaySseEvent objects as they arrive.
 * Caller should handle "navigate" → open agent, "execute" → run command.
 *
 * @param chain       The MacroChain to replay.
 * @param speedFactor 0 = instant, 1 = real-time, 2 = 2× faster (default).
 * @param signal      Optional AbortSignal to cancel mid-stream.
 */
export async function* replayChainSSE(
  chain: MacroChain,
  speedFactor = 2,
  signal?: AbortSignal,
): AsyncGenerator<ReplaySseEvent> {
  const res = await fetch("/api/bridge/macros/replay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chain, speedFactor }),
    signal,
  });

  if (!res.ok || !res.body) {
    yield { kind: "error", message: `HTTP ${res.status}` } as ReplaySseEvent;
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            yield JSON.parse(raw) as ReplaySseEvent;
          } catch {
            // malformed line — skip
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {/* best-effort */});
  }
}

// ── Inline unit tests (Vitest / NODE_ENV=test) ────────────────────────────────

if (process.env.NODE_ENV === "test") {
  /* These assertions run at module import time during vitest — see
     tests/macroLibrary.test.ts for the full test suite. */
}
