"use client";

/**
 * CommandPaletteV2 — fuzzy-search palette with keyboard macro management.
 *
 * Tabs:
 *   AGENTS  — fuzzy-search agents (replaces v1 basic includes())
 *   MACROS  — unified macro library: keyword search, keybinding macros +
 *             recorded chains with one-click inline replay
 *
 * Features:
 *   • Real fuzzy scoring with contiguous-run + word-start bonuses
 *   • Highlighted match characters in agent names
 *   • Global macro hotkey dispatcher (registers on mount)
 *   • Inline macro editor (keybinding + target agent or command)
 *   • Live bridge API streaming: type "> command" to execute any bridge command
 *   • Inline execution status bar shows last active execution phase + progress
 *   • MACROS tab: keyword search across both keybindings and recorded chains
 *   • One-click chain replay with inline SSE progress (no separate panel needed)
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import clsx from "clsx";
import { AGENTS } from "@/lib/agents";
import { listChatSummaries } from "@/lib/chatStore";
import { sfx } from "@/lib/sfx";
import { fuzzyFilter, buildHighlightSegments } from "@/lib/orchestration/fuzzySearch";
import {
  macroStore,
  formatKeybinding,
  type Macro,
  type MacroAction,
} from "@/lib/orchestration/macroStore";
import {
  executionBus,
  type ActiveExecution,
} from "@/lib/orchestration/bridgeExecutor";
import {
  macroRecorder,
  type MacroChain,
  type RecordedStep,
} from "@/lib/orchestration/macroRecorder";
import {
  searchLibrary,
  replayChainSSE,
  type ReplaySseEvent,
} from "@/lib/orchestration/macroLibrary";

// ── Types ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** open chat for an agent */
  onPickAgent: (agentId: string, prompt?: string) => void;
  /** run a named command like "open-memory" */
  onRunCommand?: (command: string) => void;
}

type Tab = "AGENTS" | "MACROS";

// ── Agent search result ───────────────────────────────────────────────────────

interface AgentItem {
  id: string;
  name: string;
  title: string;
  room: string;
  emoji: string;
  color: string;
  msgCount: number;
}

// ── Highlighted text ─────────────────────────────────────────────────────────

function HighlightedText({
  text,
  ranges,
  className,
}: {
  text: string;
  ranges: number[];
  className?: string;
}) {
  const segs = buildHighlightSegments(text, ranges);
  return (
    <span className={className}>
      {segs.map((s, i) =>
        s.highlight ? (
          <mark key={i} className="bg-transparent text-neon-cyan font-bold">
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </span>
  );
}

// ── MacroRow ──────────────────────────────────────────────────────────────────

function MacroRow({ macro, onDelete }: { macro: Macro; onDelete: () => void }) {
  const label =
    macro.action.type === "open-agent"
      ? `→ ${macro.action.agentId.toUpperCase()}`
      : macro.action.type === "send-prompt"
        ? `→ ${macro.action.agentId.toUpperCase()}: "${macro.action.prompt.slice(0, 28)}…"`
        : `⚡ ${macro.action.command}`;

  return (
    <div className="flex items-center gap-3 rounded-sm px-3 py-1.5 hover:bg-white/5 group">
      <kbd className="rounded border border-neon-purple/50 bg-black/40 px-1.5 py-0.5 text-[9px] font-mono text-neon-cyan whitespace-nowrap">
        {formatKeybinding(macro.keybinding)}
      </kbd>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-white/90 truncate">{macro.name}</div>
        <div className="text-[9px] text-white/40 truncate">{label}</div>
      </div>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 text-[10px] text-red-400/70 hover:text-red-400 transition px-1"
        title="Delete macro"
      >
        ✕
      </button>
    </div>
  );
}

// ── AddMacroForm ──────────────────────────────────────────────────────────────

function AddMacroForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [keybinding, setKeybinding] = useState("");
  const [recording, setRecording] = useState(false);
  const [actionType, setActionType] = useState<MacroAction["type"]>("open-agent");
  const [agentId, setAgentId] = useState(Object.keys(AGENTS)[0] ?? "");
  const [command, setCommand] = useState("open-memory");
  const [prompt, setPrompt] = useState("");
  const kbRef = useRef<HTMLInputElement>(null);

  // Record keybinding from actual key press
  const handleKbKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!recording) return;
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("ctrl");
      if (e.altKey) parts.push("alt");
      if (e.shiftKey) parts.push("shift");
      if (e.metaKey) parts.push("meta");
      const key = e.key.toLowerCase();
      if (!["control", "alt", "shift", "meta"].includes(key)) {
        parts.push(key);
        setKeybinding(parts.join("+"));
        setRecording(false);
      }
    },
    [recording],
  );

  const handleSubmit = useCallback(() => {
    if (!name || !keybinding) return;
    let action: MacroAction;
    if (actionType === "open-agent") {
      action = { type: "open-agent", agentId };
    } else if (actionType === "send-prompt") {
      action = { type: "send-prompt", agentId, prompt };
    } else {
      action = { type: "run-command", command };
    }
    macroStore.add({ name, keybinding, action });
    onDone();
  }, [name, keybinding, actionType, agentId, prompt, command, onDone]);

  return (
    <div className="border border-neon-purple/30 rounded-sm mx-3 my-2 p-3 flex flex-col gap-2 bg-black/20">
      <div className="pixel text-[9px] text-neon-cyan mb-1">+ NEW MACRO</div>

      {/* Name */}
      <input
        placeholder="macro name…"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="bg-transparent border border-white/10 rounded-sm px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/40"
      />

      {/* Keybinding recorder */}
      <div className="flex gap-2 items-center">
        <input
          ref={kbRef}
          readOnly
          placeholder="click Record then press keys…"
          value={keybinding}
          onKeyDown={handleKbKeyDown}
          className={clsx(
            "flex-1 bg-transparent border rounded-sm px-2 py-1 text-[11px] focus:outline-none font-mono",
            recording
              ? "border-neon-cyan/60 text-neon-cyan animate-pulse"
              : "border-white/10 text-white placeholder:text-white/30",
          )}
        />
        <button
          onClick={() => {
            setRecording(true);
            kbRef.current?.focus();
          }}
          className={clsx(
            "px-2 py-1 rounded-sm text-[9px] pixel border transition",
            recording
              ? "border-neon-cyan text-neon-cyan"
              : "border-white/20 text-white/50 hover:border-neon-purple/60",
          )}
        >
          {recording ? "LISTENING…" : "RECORD"}
        </button>
      </div>

      {/* Action type */}
      <select
        value={actionType}
        onChange={(e) => setActionType(e.target.value as MacroAction["type"])}
        className="bg-black/60 border border-white/10 rounded-sm px-2 py-1 text-[11px] text-white/80 focus:outline-none focus:border-neon-purple/40"
      >
        <option value="open-agent">Open Agent</option>
        <option value="send-prompt">Send Prompt to Agent</option>
        <option value="run-command">Run Command</option>
      </select>

      {/* Action params */}
      {(actionType === "open-agent" || actionType === "send-prompt") && (
        <select
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          className="bg-black/60 border border-white/10 rounded-sm px-2 py-1 text-[11px] text-white/80 focus:outline-none"
        >
          {Object.values(AGENTS).map((a) => (
            <option key={a.id} value={a.id}>
              {a.emoji} {a.name}
            </option>
          ))}
        </select>
      )}

      {actionType === "send-prompt" && (
        <input
          placeholder="prompt text…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="bg-transparent border border-white/10 rounded-sm px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none"
        />
      )}

      {actionType === "run-command" && (
        <input
          placeholder="command (e.g. open-memory)"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          className="bg-transparent border border-white/10 rounded-sm px-2 py-1 text-[11px] text-white placeholder:text-white/30 focus:outline-none font-mono"
        />
      )}

      <div className="flex gap-2 justify-end">
        <button
          onClick={onDone}
          className="px-2 py-1 text-[9px] text-white/40 hover:text-white/70 transition"
        >
          CANCEL
        </button>
        <button
          onClick={handleSubmit}
          disabled={!name || !keybinding}
          className="px-3 py-1 text-[9px] pixel rounded-sm border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-30 transition"
        >
          SAVE
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// ── Step label helper (shared by chain rows) ──────────────────────────────────

function stepLabel(step: RecordedStep): string {
  switch (step.kind) {
    case "open-agent":
      return `→ ${(step.agentId ?? "?").toUpperCase()}`;
    case "send-prompt":
      return `→ ${(step.agentId ?? "?").toUpperCase()}: "${(step.prompt ?? "").slice(0, 28)}…"`;
    case "run-command":
      return `⚡ ${step.command ?? "?"}`;
    default:
      return "?";
  }
}

// ── ChainLibraryRow ──────────────────────────────────────────────────────────

interface ChainReplayState {
  chainId: string;
  currentStep: number;
  totalSteps: number;
  msg: string;
  status: "running" | "done" | "error";
}

function ChainLibraryRow({
  chain,
  replay,
  anyReplaying,
  onPlay,
  onDelete,
}: {
  chain: MacroChain;
  replay: ChainReplayState | null;
  anyReplaying: boolean;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const isThis = replay?.chainId === chain.id;
  const pct =
    isThis && replay
      ? Math.round(((replay.currentStep + 1) / replay.totalSteps) * 100)
      : 0;

  return (
    <div
      className={clsx(
        "rounded-sm border px-2.5 py-2 transition group/chain",
        isThis
          ? "border-neon-cyan/40 bg-neon-cyan/5"
          : "border-white/10 bg-black/20 hover:bg-white/5",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-white/90 font-medium truncate">{chain.name}</span>
        <span className="text-[8px] text-white/25 shrink-0">
          {chain.steps.length}step · {chain.durationMs < 1000 ? `${chain.durationMs}ms` : `${(chain.durationMs / 1000).toFixed(1)}s`}
        </span>
        <button
          onClick={onPlay}
          disabled={anyReplaying}
          title={isThis ? "Replaying…" : "Replay this chain"}
          className={clsx(
            "rounded-sm border px-1.5 py-0.5 text-[9px] pixel transition shrink-0",
            isThis && replay?.status === "running"
              ? "border-neon-cyan text-neon-cyan animate-pulse"
              : isThis && replay?.status === "done"
                ? "border-neon-green/60 text-neon-green/80"
                : isThis && replay?.status === "error"
                  ? "border-red-500/60 text-red-400"
                  : anyReplaying
                    ? "border-white/10 text-white/20 cursor-not-allowed"
                    : "border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10",
          )}
        >
          {isThis
            ? replay?.status === "running"
              ? "▶▶"
              : replay?.status === "done"
                ? "✔"
                : "✖"
            : "▶"}
        </button>
        <button
          onClick={onDelete}
          disabled={anyReplaying}
          className="opacity-0 group-hover/chain:opacity-100 text-[9px] text-white/20 hover:text-red-400 transition shrink-0 px-0.5"
          title="Delete chain"
        >
          ✕
        </button>
      </div>

      {/* Replay progress */}
      {isThis && replay && replay.status === "running" && (
        <div className="mt-1.5">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-neon-cyan/70 truncate">{replay.msg}</span>
            <span className="text-[8px] text-white/25 shrink-0 ml-2">
              {replay.currentStep + 1}/{replay.totalSteps}
            </span>
          </div>
          <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-neon-cyan/70 transition-all duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Step preview */}
      <div className="mt-1 space-y-0 max-h-[60px] overflow-hidden">
        {chain.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1">
            <span
              className={clsx(
                "text-[7px] font-mono w-3 text-right shrink-0",
                isThis && replay && i <= replay.currentStep
                  ? "text-neon-cyan/50"
                  : "text-white/15",
              )}
            >
              {i + 1}.
            </span>
            <span
              className={clsx(
                "text-[7px] truncate",
                isThis && replay && i <= replay.currentStep
                  ? "text-neon-cyan/70"
                  : "text-white/25",
              )}
            >
              {stepLabel(step)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CommandPaletteV2({ open, onClose, onPickAgent, onRunCommand }: Props) {
  const [tab, setTab] = useState<Tab>("AGENTS");
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [addingMacro, setAddingMacro] = useState(false);

  // Macro library: keyword search state
  const [macroQ, setMacroQ] = useState("");

  // Chain replay state
  const [chainReplay, setChainReplay] = useState<ChainReplayState | null>(null);
  const chainReplayAbort = useRef<AbortController | null>(null);

  // Subscribe to macro store changes
  const macros = useSyncExternalStore(
    (cb) => macroStore.subscribe(cb),
    () => macroStore.getAll(),
    () => [] as Macro[],
  );

  // Subscribe to macro recorder (for chains list + recording indicator)
  const recorderSnap = useSyncExternalStore(
    (cb) => macroRecorder.subscribe(cb),
    () => ({
      chains: macroRecorder.getChains(),
    }),
    () => ({ chains: [] as MacroChain[] }),
  );
  const chains = recorderSnap.chains;

  // Unified fuzzy-search across macros + chains (MACROS tab)
  const libraryResults = useMemo(
    () => searchLibrary(macros, chains, macroQ),
    [macros, chains, macroQ],
  );

  // Build agent items
  const summaries = useMemo(() => {
    if (!open) return [];
    return listChatSummaries(Object.keys(AGENTS));
  }, [open]);

  const agentItems: AgentItem[] = useMemo(
    () =>
      Object.values(AGENTS).map((a) => ({
        id: a.id,
        name: a.name,
        title: a.title,
        room: a.room,
        emoji: a.emoji,
        color: a.color,
        msgCount: summaries.find((s) => s.agentId === a.id)?.count ?? 0,
      })),
    [summaries],
  );

  // Fuzzy-filtered results
  const fuzzyResults = useMemo(() => {
    return fuzzyFilter(agentItems, q, (a) => [a.name, a.title, a.room, a.id]);
  }, [agentItems, q]);

  // Reset state on open; abort any running replay on close
  useEffect(() => {
    if (!open) {
      chainReplayAbort.current?.abort();
      return;
    }
    sfx.open();
    setQ("");
    setIdx(0);
    setTab("AGENTS");
    setAddingMacro(false);
    setMacroQ("");
  }, [open]);

  // Clamp idx when results change
  useEffect(() => {
    setIdx((i) => Math.max(0, Math.min(i, fuzzyResults.length - 1)));
  }, [fuzzyResults.length]);

  // Subscribe to execution bus for inline status
  const activeExecutions = useSyncExternalStore(
    (cb) => executionBus.subscribe(cb),
    () => executionBus.getAll(),
    () => [] as ActiveExecution[],
  );
  // Most recent (last started) execution
  const latestExec = activeExecutions.at(-1);

  // Derive recording indicator from recorderSnap (already subscribed above)
  const isRecording = useSyncExternalStore(
    (cb) => macroRecorder.subscribe(cb),
    () => macroRecorder.isRecording,
    () => false,
  );

  // Wrappers that push to macroRecorder when a session is active
  const recordedPickAgent = useCallback(
    (agentId: string, prompt?: string) => {
      macroRecorder.push(
        prompt
          ? { kind: "send-prompt", agentId, prompt }
          : { kind: "open-agent", agentId },
      );
      onPickAgent(agentId, prompt);
    },
    [onPickAgent],
  );

  const recordedRunCommand = useCallback(
    (command: string) => {
      macroRecorder.push({ kind: "run-command", command });
      onRunCommand?.(command);
    },
    [onRunCommand],
  );

  // One-click chain replay — streams SSE from /api/bridge/macros/replay
  const handleChainReplay = useCallback(
    async (chain: MacroChain) => {
      if (chainReplay?.status === "running") return;

      chainReplayAbort.current?.abort();
      const ctrl = new AbortController();
      chainReplayAbort.current = ctrl;

      setChainReplay({
        chainId: chain.id,
        currentStep: -1,
        totalSteps: chain.steps.length,
        msg: "Starting…",
        status: "running",
      });

      try {
        for await (const evt of replayChainSSE(chain, 2, ctrl.signal)) {
          switch (evt.kind) {
            case "step-start":
              setChainReplay((s) =>
                s
                  ? {
                      ...s,
                      currentStep: evt.index ?? s.currentStep,
                      msg: evt.step ? stepLabel(evt.step) : s.msg,
                    }
                  : null,
              );
              break;

            case "navigate":
              if (evt.agentId) {
                recordedPickAgent(evt.agentId, evt.prompt);
              }
              break;

            case "execute":
              if (evt.command) {
                recordedRunCommand(evt.command);
              }
              break;

            case "done":
              setChainReplay((s) =>
                s
                  ? { ...s, status: "done", currentStep: chain.steps.length - 1, msg: "Done ✓" }
                  : null,
              );
              setTimeout(() => setChainReplay(null), 2_000);
              break;

            case "error":
              setChainReplay((s) =>
                s ? { ...s, status: "error", msg: evt.message ?? "Error" } : null,
              );
              setTimeout(() => setChainReplay(null), 3_500);
              break;
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setChainReplay((s) => (s ? { ...s, status: "error", msg: "Stream error" } : null));
          setTimeout(() => setChainReplay(null), 3_500);
        }
      }
    },
    [chainReplay, recordedPickAgent, recordedRunCommand],
  );

  // Execute a macro action — run-command goes through bridge API
  const executeMacro = useCallback(
    (macro: Macro) => {
      sfx.select();
      if (macro.action.type === "open-agent") {
        recordedPickAgent(macro.action.agentId);
      } else if (macro.action.type === "send-prompt") {
        recordedPickAgent(macro.action.agentId, macro.action.prompt);
      } else if (macro.action.type === "run-command") {
        // Fire bridge execute (non-blocking — ExecutionToastHost shows progress)
        void executionBus.run(macro.action.command);
        recordedRunCommand(macro.action.command);
      }
    },
    [recordedPickAgent, recordedRunCommand],
  );

  /**
   * Handle direct bridge command typed as "> command" in the search box.
   * E.g. "> open-memory", "> status"
   */
  const handleDirectCommand = useCallback(
    (raw: string) => {
      const cmd = raw.slice(1).trim();
      if (!cmd) return;
      sfx.select();
      void executionBus.run(cmd);
      recordedRunCommand(cmd);
      onClose();
    },
    [recordedRunCommand, onClose],
  );

  // Global macro hotkey dispatcher (always active, not just when palette open)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't fire macros when typing in an input/textarea (except our palette)
      const target = e.target as HTMLElement;
      if (
        !open &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return;
      }
      const found = macroStore.findByEvent(e);
      if (found) {
        e.preventDefault();
        executeMacro(found);
        if (!open) return; // palette was closed, executed in background
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [open, executeMacro]);

  // Palette-specific navigation
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setTab((t) => (t === "AGENTS" ? "MACROS" : "AGENTS"));
      } else if (tab === "AGENTS") {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setIdx((i) => Math.min(fuzzyResults.length - 1, i + 1));
          sfx.tab();
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setIdx((i) => Math.max(0, i - 1));
          sfx.tab();
        } else if (e.key === "Enter") {
          e.preventDefault();
          // "> command" mode — execute bridge command directly
          if (q.trimStart().startsWith(">")) {
            handleDirectCommand(q.trimStart());
            return;
          }
          const r = fuzzyResults[idx];
          if (r) {
            sfx.select();
            recordedPickAgent(r.item.id);
          }
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, tab, fuzzyResults, idx, q, onClose, recordedPickAgent, handleDirectCommand]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm pt-24 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="neon-frame w-[min(580px,94vw)] rounded-sm animate-slide-up flex flex-col"
        style={{ maxHeight: "min(600px,80vh)" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-neon-purple/40 px-3 py-2 shrink-0">
          {/* Tabs */}
          <div className="flex gap-1 mr-2">
            {(["AGENTS", "MACROS"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  "pixel text-[9px] px-2 py-0.5 rounded-sm border transition",
                  tab === t
                    ? "border-neon-cyan text-neon-cyan bg-neon-cyan/10"
                    : "border-white/20 text-white/40 hover:border-white/40",
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Recording indicator dot */}
          {isRecording && (
            <div
              className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444] animate-pulse shrink-0"
              title="Macro recorder active — actions are being captured"
            />
          )}

          {tab === "AGENTS" && (
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setIdx(0);
              }}
              placeholder="fuzzy search agents…"
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
            />
          )}
          {tab === "MACROS" && (
            <input
              autoFocus
              value={macroQ}
              onChange={(e) => setMacroQ(e.target.value)}
              placeholder="search macros & chains…"
              className="flex-1 bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
            />
          )}

          <span className="rounded-sm border border-white/20 px-1.5 py-0.5 text-[9px] text-white/60">
            ESC
          </span>
        </div>

        {/* Body */}
        <div className="overflow-auto flex-1 p-1">
          {/* ── AGENTS TAB ── */}
          {tab === "AGENTS" && (
            <>
              {/* Direct bridge command mode (query starts with ">") */}
              {q.trimStart().startsWith(">") && (
                <button
                  onClick={() => handleDirectCommand(q.trimStart())}
                  className="flex items-center gap-3 rounded-sm px-3 py-2 text-left transition bg-neon-cyan/5 border border-neon-cyan/20 mx-1 my-1"
                  style={{ width: "calc(100% - 8px)" }}
                >
                  <span className="text-neon-cyan text-xl">⚡</span>
                  <div className="flex-1 min-w-0">
                    <div className="pixel text-[11px] tracking-widest text-neon-cyan">
                      RUN COMMAND
                    </div>
                    <div className="text-[10px] text-neon-cyan/60 font-mono truncate">
                      {q.trimStart().slice(1).trim() || "…type command name"}
                    </div>
                  </div>
                  <span className="text-[10px] text-white/40 shrink-0">↵</span>
                </button>
              )}
              {!q.trimStart().startsWith(">") && fuzzyResults.length === 0 && (
                <div className="px-3 py-6 text-center text-[11px] text-white/40">
                  no match · type <kbd className="font-mono bg-white/10 px-1 rounded">&gt; cmd</kbd> to run a bridge command
                </div>
              )}
              {fuzzyResults.map(({ item, ranges }, i) => {
                const active = i === idx;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      sfx.select();
                      recordedPickAgent(item.id);
                    }}
                    onMouseEnter={() => setIdx(i)}
                    className={clsx(
                      "flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left transition",
                      active && "bg-white/10",
                    )}
                    style={{ color: item.color }}
                  >
                    <div className="text-xl">{item.emoji}</div>
                    <div className="flex-1 min-w-0">
                      <div className="pixel text-[11px] tracking-widest">
                        <HighlightedText text={item.name} ranges={ranges} />
                      </div>
                      <div className="text-[10px] uppercase text-white/50 truncate">
                        {item.title} · {item.room}
                      </div>
                    </div>
                    {item.msgCount > 0 && (
                      <div className="rounded-sm border border-white/20 px-1.5 py-0.5 text-[9px] text-white/70 shrink-0">
                        {item.msgCount} msg
                      </div>
                    )}
                    {/* Show macro hint if this agent has a macro */}
                    {macros.find(
                      (m) =>
                        m.action.type === "open-agent" && m.action.agentId === item.id,
                    ) && (
                      <kbd className="rounded border border-neon-purple/40 px-1 py-0.5 text-[8px] font-mono text-neon-purple/70 shrink-0">
                        {formatKeybinding(
                          macros.find(
                            (m) =>
                              m.action.type === "open-agent" && m.action.agentId === item.id,
                          )!.keybinding,
                        )}
                      </kbd>
                    )}
                    <span className="text-[10px] text-white/40 shrink-0">↵</span>
                  </button>
                );
              })}
            </>
          )}

          {/* ── MACROS TAB — unified library: chains + keybindings ── */}
          {tab === "MACROS" && (() => {
            const anyReplaying = chainReplay?.status === "running";

            // Filtered chains and macros from library search
            const visibleChains = libraryResults
              .filter((r) => r.item.kind === "chain")
              .map((r) => (r.item as { kind: "chain"; chain: MacroChain }).chain);

            const visibleMacros = libraryResults
              .filter((r) => r.item.kind === "macro")
              .map((r) => (r.item as { kind: "macro"; macro: Macro }).macro);

            const emptyResults =
              macroQ.trim() && visibleChains.length === 0 && visibleMacros.length === 0;

            return (
              <>
                {/* Empty state */}
                {emptyResults && (
                  <div className="px-3 py-6 text-center text-[11px] text-white/40">
                    no match for &ldquo;{macroQ}&rdquo;
                  </div>
                )}

                {/* ── CHAINS section ── */}
                {visibleChains.length > 0 && (
                  <div className="px-1 pt-1 pb-0.5">
                    <div className="px-2 pb-1 text-[8px] pixel text-neon-purple/60 tracking-widest">
                      RECORDED CHAINS
                    </div>
                    <div className="space-y-1.5 px-1">
                      {visibleChains.map((chain) => (
                        <ChainLibraryRow
                          key={chain.id}
                          chain={chain}
                          replay={chainReplay?.chainId === chain.id ? chainReplay : null}
                          anyReplaying={anyReplaying}
                          onPlay={() => void handleChainReplay(chain)}
                          onDelete={() => macroRecorder.deleteChain(chain.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* ── KEYBINDINGS section ── */}
                {(visibleMacros.length > 0 || (!macroQ.trim() && !addingMacro)) && (
                  <div className="px-1 pt-1.5">
                    {(visibleChains.length > 0 || chains.length > 0) && (
                      <div className="px-2 pb-1 text-[8px] pixel text-neon-purple/60 tracking-widest">
                        KEYBINDINGS
                      </div>
                    )}
                    {visibleMacros.length === 0 && !macroQ.trim() && !addingMacro && (
                      <div className="px-3 py-2 text-center text-[11px] text-white/30">
                        no keybinding macros yet
                      </div>
                    )}
                    {visibleMacros.map((m) => (
                      <MacroRow
                        key={m.id}
                        macro={m}
                        onDelete={() => macroStore.remove(m.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Add macro form / button */}
                {!macroQ.trim() && (
                  addingMacro ? (
                    <AddMacroForm onDone={() => setAddingMacro(false)} />
                  ) : (
                    <button
                      onClick={() => setAddingMacro(true)}
                      className="w-full text-center text-[10px] text-white/30 hover:text-neon-cyan/70 py-2 transition pixel"
                    >
                      + ADD KEYBINDING
                    </button>
                  )
                )}
              </>
            );
          })()}
        </div>

        {/* Footer */}
        <div className="border-t border-neon-purple/40 shrink-0">
          {/* Inline execution status strip */}
          {latestExec && (
            <div
              className={clsx(
                "flex items-center gap-2 px-3 py-1 text-[10px] font-mono border-b border-neon-purple/20",
                latestExec.status === "error"
                  ? "text-red-400 bg-red-950/30"
                  : latestExec.status === "done"
                    ? "text-neon-green/80 bg-neon-green/5"
                    : "text-neon-cyan/80 bg-neon-cyan/5",
              )}
            >
              {/* Spinner / icon */}
              <span className="shrink-0">
                {latestExec.status === "running" ? (
                  <span className="inline-block animate-spin-slow">◌</span>
                ) : latestExec.status === "done" ? (
                  "✔"
                ) : (
                  "✖"
                )}
              </span>

              {/* Command + message */}
              <span className="pixel text-[8px] shrink-0 text-white/30 uppercase">
                {latestExec.command}
              </span>
              <span className="truncate flex-1">
                {latestExec.status === "running"
                  ? (latestExec.events.findLast?.((e) => e.message)?.message ??
                     latestExec.events.slice().reverse().find((e) => e.message)?.message ??
                     "Running…")
                  : latestExec.status === "done"
                    ? latestExec.result
                    : latestExec.error}
              </span>

              {/* Progress bar (running only) */}
              {latestExec.status === "running" && (
                <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden shrink-0">
                  <div
                    className="h-full bg-neon-cyan/70 transition-all duration-200"
                    style={{ width: `${latestExec.pct}%` }}
                  />
                </div>
              )}

              {/* Duration */}
              {latestExec.finishedAt && (
                <span className="text-white/20 shrink-0">
                  {latestExec.finishedAt - latestExec.startedAt}ms
                </span>
              )}

              {/* Dismiss */}
              {latestExec.status !== "running" && (
                <button
                  onClick={() => executionBus.dismiss(latestExec.id)}
                  className="shrink-0 text-white/20 hover:text-white/60 transition px-1"
                  title="Dismiss"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-3 py-1.5 text-[9px] text-white/40">
            {tab === "AGENTS" && (
              <>
                <span>↑↓ · ↵ open · &gt; cmd bridge · Tab · ESC</span>
                <span>{fuzzyResults.length} agents</span>
              </>
            )}
            {tab === "MACROS" && (
              <>
                <span>▶ replay chain · Tab switch · ESC close</span>
                <span>
                  {chains.length} chain{chains.length !== 1 ? "s" : ""} · {macros.length} keybinding{macros.length !== 1 ? "s" : ""}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
