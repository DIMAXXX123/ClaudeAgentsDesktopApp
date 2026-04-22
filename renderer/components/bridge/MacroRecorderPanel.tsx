"use client";

/**
 * MacroRecorderPanel — floating panel for recording and replaying macro chains.
 *
 * Usage: drop into any parent as an always-rendered layer; the `open` prop
 * controls visibility. Wire `onPickAgent` / `onRunCommand` into the same
 * callbacks as CommandPaletteV2 so replayed steps produce real effects.
 *
 * Recording:
 *   • Press "⏺ REC" to start.
 *   • Perform actions in the command palette — each fires macroRecorder.push().
 *   • Press "⏹ STOP" → name the chain → saved.
 *
 * Replay:
 *   • Click ▶ on any saved chain.
 *   • Panel shows step-by-step progress via SSE from /api/bridge/macros/replay.
 *   • navigate/execute events call onPickAgent / onRunCommand in real time.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import clsx from "clsx";
import {
  macroRecorder,
  type MacroChain,
  type RecordedStep,
  type ReplayStepEvent,
} from "@/lib/orchestration/macroRecorder";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called when a replayed step navigates to an agent. */
  onPickAgent: (agentId: string, prompt?: string) => void;
  /** Called when a replayed step fires a bridge command. */
  onRunCommand?: (command: string) => void;
}

interface ReplayState {
  chainId: string;
  currentStep: number;
  totalSteps: number;
  status: "running" | "done" | "error";
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepLabel(step: RecordedStep): string {
  switch (step.kind) {
    case "open-agent":
      return `→ ${step.agentId?.toUpperCase() ?? "?"}`;
    case "send-prompt":
      return `→ ${step.agentId?.toUpperCase() ?? "?"}: "${(step.prompt ?? "").slice(0, 30)}…"`;
    case "run-command":
      return `⚡ ${step.command ?? "?"}`;
    default:
      return "?";
  }
}

function msLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── ChainRow ──────────────────────────────────────────────────────────────────

function ChainRow({
  chain,
  replaying,
  replayState,
  onPlay,
  onDelete,
}: {
  chain: MacroChain;
  replaying: boolean;
  replayState: ReplayState | null;
  onPlay: () => void;
  onDelete: () => void;
}) {
  const isThisReplaying = replaying && replayState?.chainId === chain.id;

  return (
    <div
      className={clsx(
        "rounded-sm border px-3 py-2 transition",
        isThisReplaying
          ? "border-neon-cyan/40 bg-neon-cyan/5"
          : "border-white/10 bg-black/20 hover:bg-white/5",
      )}
    >
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="flex-1 text-[11px] text-white/90 font-medium truncate">{chain.name}</span>
        <span className="text-[9px] text-white/30 shrink-0">
          {chain.steps.length} step{chain.steps.length !== 1 ? "s" : ""} ·{" "}
          {msLabel(chain.durationMs)}
        </span>
        {/* Play button */}
        <button
          onClick={onPlay}
          disabled={replaying}
          className={clsx(
            "rounded-sm border px-2 py-0.5 text-[9px] pixel transition shrink-0",
            isThisReplaying
              ? "border-neon-cyan text-neon-cyan animate-pulse"
              : replaying
                ? "border-white/10 text-white/20 cursor-not-allowed"
                : "border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10",
          )}
          title="Replay this chain"
        >
          {isThisReplaying ? "PLAYING" : "▶"}
        </button>
        {/* Delete button */}
        <button
          onClick={onDelete}
          disabled={replaying}
          className="text-[9px] text-white/20 hover:text-red-400 transition shrink-0 px-1"
          title="Delete chain"
        >
          ✕
        </button>
      </div>

      {/* Replay progress */}
      {isThisReplaying && replayState && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-neon-cyan/70 font-mono truncate">
              {replayState.message ?? "Replaying…"}
            </span>
            <span className="text-[9px] text-white/30 shrink-0 ml-2">
              {replayState.currentStep + 1}/{replayState.totalSteps}
            </span>
          </div>
          <div className="h-0.5 w-full bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-neon-cyan/70 transition-all duration-300"
              style={{
                width: `${Math.round(
                  ((replayState.currentStep + 1) / replayState.totalSteps) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Step list (collapsed; show on hover via group) */}
      <div className="mt-1.5 space-y-0.5">
        {chain.steps.map((step, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span
              className={clsx(
                "text-[8px] font-mono w-4 text-right shrink-0",
                isThisReplaying && replayState && i <= replayState.currentStep
                  ? "text-neon-cyan/60"
                  : "text-white/20",
              )}
            >
              {i + 1}.
            </span>
            <span
              className={clsx(
                "text-[8px] truncate",
                isThisReplaying && replayState && i <= replayState.currentStep
                  ? "text-neon-cyan/80"
                  : "text-white/30",
              )}
            >
              {stepLabel(step)}
            </span>
            {step.delayMs > 80 && (
              <span className="text-[7px] text-white/15 shrink-0 ml-auto">
                +{msLabel(step.delayMs)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NameChainModal ────────────────────────────────────────────────────────────

function NameChainModal({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div className="absolute inset-0 z-10 bg-black/60 flex items-center justify-center rounded-sm">
      <div className="neon-frame rounded-sm p-4 w-[280px] flex flex-col gap-3">
        <div className="pixel text-[10px] text-neon-cyan">SAVE RECORDING</div>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && name.trim()) onSave(name.trim());
            if (e.key === "Escape") onSave("");
          }}
          placeholder="chain name…"
          className="bg-transparent border border-white/20 rounded-sm px-2 py-1.5 text-[12px] text-white placeholder:text-white/30 focus:outline-none focus:border-neon-cyan/40"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => onSave("")}
            className="text-[9px] text-white/30 hover:text-white/60 transition px-2"
          >
            DISCARD
          </button>
          <button
            onClick={() => { if (name.trim()) onSave(name.trim()); }}
            disabled={!name.trim()}
            className="pixel text-[9px] px-3 py-1 rounded-sm border border-neon-purple/50 text-neon-purple hover:bg-neon-purple/10 disabled:opacity-30 transition"
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function MacroRecorderPanel({ open, onClose, onPickAgent, onRunCommand }: Props) {
  // Subscribe to recorder state
  const _snapshot = useSyncExternalStore(
    (cb) => macroRecorder.subscribe(cb),
    () => ({
      recording: macroRecorder.isRecording,
      pendingSteps: macroRecorder.pendingSteps,
      chains: macroRecorder.getChains(),
    }),
    () => ({ recording: false, pendingSteps: [] as RecordedStep[], chains: [] as MacroChain[] }),
  );
  const { recording, pendingSteps, chains } = _snapshot;

  const [namingChain, setNamingChain] = useState(false);
  const [replayState, setReplayState] = useState<ReplayState | null>(null);
  const [speedFactor, setSpeedFactor] = useState(2);
  const abortRef = useRef<AbortController | null>(null);

  const replaying = replayState !== null && replayState.status === "running";

  // ── Recording controls ────────────────────────────────────────────────────

  const handleStartRec = useCallback(() => {
    macroRecorder.start();
  }, []);

  const handleStopRec = useCallback(() => {
    // Show naming modal, then finalize
    setNamingChain(true);
  }, []);

  const handleCancelRec = useCallback(() => {
    macroRecorder.cancel();
  }, []);

  const handleSaveName = useCallback((name: string) => {
    setNamingChain(false);
    if (!name) {
      macroRecorder.cancel();
      return;
    }
    macroRecorder.stop(name);
  }, []);

  // ── Replay via SSE ───────────────────────────────────────────────────────

  const handlePlay = useCallback(
    async (chain: MacroChain) => {
      if (replaying) return;

      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setReplayState({
        chainId: chain.id,
        currentStep: -1,
        totalSteps: chain.steps.length,
        status: "running",
        message: "Starting…",
      });

      try {
        const res = await fetch("/api/bridge/macros/replay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chain, speedFactor }),
          signal: ctrl.signal,
        });

        if (!res.ok || !res.body) {
          setReplayState((s) => s && { ...s, status: "error", message: `HTTP ${res.status}` });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";

        // eslint-disable-next-line no-constant-condition
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
                const evt = JSON.parse(raw) as ReplayStepEvent;
                handleReplayEvent(evt, chain);
              } catch {
                // malformed — skip
              }
            }
          }
        }
      } catch (err) {
        if ((err as { name?: string }).name !== "AbortError") {
          setReplayState((s) => s && { ...s, status: "error", message: "Stream error" });
        }
      }
    },
    [replaying, speedFactor], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Handle a single SSE replay event
  const handleReplayEvent = useCallback(
    (evt: ReplayStepEvent, chain: MacroChain) => {
      switch (evt.kind) {
        case "step-start":
          setReplayState((s) =>
            s
              ? {
                  ...s,
                  currentStep: evt.index ?? s.currentStep,
                  message: evt.step ? stepLabel(evt.step) : s.message,
                }
              : null,
          );
          break;

        case "navigate":
          if (evt.agentId) {
            onPickAgent(evt.agentId, evt.prompt);
          }
          break;

        case "execute":
          if (evt.command) {
            onRunCommand?.(evt.command);
          }
          break;

        case "done":
          setReplayState((s) =>
            s ? { ...s, status: "done", currentStep: chain.steps.length - 1 } : null,
          );
          setTimeout(() => setReplayState(null), 2_500);
          break;

        case "error":
          setReplayState((s) =>
            s ? { ...s, status: "error", message: evt.message ?? "Error" } : null,
          );
          setTimeout(() => setReplayState(null), 4_000);
          break;

        default:
          break;
      }
    },
    [onPickAgent, onRunCommand],
  );

  // Abort replay on unmount / close
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/70 backdrop-blur-sm pt-24 animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="neon-frame w-[min(520px,94vw)] rounded-sm flex flex-col relative"
        style={{ maxHeight: "min(620px,82vh)" }}
      >
        {/* Name modal (overlay) */}
        {namingChain && <NameChainModal onSave={handleSaveName} />}

        {/* Header */}
        <div className="flex items-center gap-2 border-b border-neon-purple/40 px-3 py-2 shrink-0">
          {/* Recording indicator */}
          <div className="flex items-center gap-1.5 mr-1">
            <div
              className={clsx(
                "w-2.5 h-2.5 rounded-full transition-all duration-300",
                recording
                  ? "bg-red-500 shadow-[0_0_6px_#ef4444] animate-pulse"
                  : "bg-white/20",
              )}
            />
            <span className="pixel text-[9px] text-white/50">MACRO RECORDER</span>
          </div>

          <div className="flex-1" />

          {/* Controls */}
          {!recording ? (
            <button
              onClick={handleStartRec}
              className="pixel text-[9px] px-2.5 py-1 rounded-sm border border-red-500/60 text-red-400 hover:bg-red-500/10 transition"
            >
              ⏺ REC
            </button>
          ) : (
            <div className="flex gap-1">
              <span className="text-[9px] text-white/40 self-center mr-1">
                {pendingSteps.length} step{pendingSteps.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={handleStopRec}
                className="pixel text-[9px] px-2.5 py-1 rounded-sm border border-neon-cyan/50 text-neon-cyan hover:bg-neon-cyan/10 transition"
              >
                ⏹ STOP
              </button>
              <button
                onClick={handleCancelRec}
                className="text-[9px] text-white/30 hover:text-red-400 transition px-1.5"
                title="Cancel recording (discard steps)"
              >
                ✕
              </button>
            </div>
          )}

          {/* Speed selector */}
          {!recording && (
            <div className="flex items-center gap-1 ml-2">
              <span className="text-[8px] text-white/30">speed</span>
              <select
                value={speedFactor}
                onChange={(e) => setSpeedFactor(Number(e.target.value))}
                className="bg-black/40 border border-white/10 rounded-sm px-1 py-0.5 text-[9px] text-white/60 focus:outline-none"
              >
                <option value={0}>instant</option>
                <option value={3}>3×</option>
                <option value={2}>2×</option>
                <option value={1}>1× real</option>
              </select>
            </div>
          )}

          <button
            onClick={onClose}
            className="ml-2 text-[9px] text-white/30 hover:text-white/70 transition"
          >
            ESC
          </button>
        </div>

        {/* Live recording preview */}
        {recording && pendingSteps.length > 0 && (
          <div className="border-b border-red-500/20 bg-red-950/10 px-3 py-2 shrink-0">
            <div className="pixel text-[8px] text-red-400/70 mb-1.5">RECORDING IN PROGRESS</div>
            <div className="space-y-0.5 max-h-[120px] overflow-auto">
              {pendingSteps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-[8px] text-red-400/40 font-mono w-4 text-right shrink-0">
                    {i + 1}.
                  </span>
                  <span className="text-[8px] text-red-400/70 truncate">{stepLabel(step)}</span>
                  <span className="text-[7px] text-white/15 ml-auto shrink-0">
                    {msLabel(step.delayMs)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chain list */}
        <div className="overflow-auto flex-1 p-2 space-y-2">
          {chains.length === 0 && !recording && (
            <div className="px-3 py-8 text-center text-[11px] text-white/30">
              No chains recorded yet.
              <br />
              <span className="text-[9px] text-white/20">
                Press ⏺ REC then perform actions in the command palette.
              </span>
            </div>
          )}
          {recording && pendingSteps.length === 0 && (
            <div className="px-3 py-4 text-center text-[10px] text-red-400/50 animate-pulse">
              Recording… open agents or run commands to capture steps.
            </div>
          )}
          {chains.map((chain) => (
            <ChainRow
              key={chain.id}
              chain={chain}
              replaying={replaying}
              replayState={replayState}
              onPlay={() => void handlePlay(chain)}
              onDelete={() => macroRecorder.deleteChain(chain.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-neon-purple/40 px-3 py-1.5 text-[8px] text-white/25 flex justify-between shrink-0">
          <span>max 20 chains stored locally</span>
          <span>{chains.length} saved</span>
        </div>
      </div>
    </div>
  );
}
