"use client";

/**
 * ExecutionToast — live-streaming execution feedback toasts.
 *
 * Subscribes to executionBus and renders active executions as
 * stacked toasts with real-time progress bars and status icons.
 *
 * Place <ExecutionToastHost /> once in your app layout (near ToastHost).
 */

import { useEffect, useSyncExternalStore } from "react";
import clsx from "clsx";
import { executionBus, type ActiveExecution } from "@/lib/orchestration/bridgeExecutor";
import { pushToast } from "@/lib/toastBus";

// ── Single execution toast ─────────────────────────────────────────────────────

function ExecToast({ exec }: { exec: ActiveExecution }) {
  const isDone = exec.status === "done";
  const isError = exec.status === "error";
  const isRunning = exec.status === "running";

  // Push a simple toast when done/error (one-shot)
  useEffect(() => {
    if (isDone && exec.result) {
      pushToast(`✔ ${exec.result}`, "success");
    } else if (isError && exec.error) {
      pushToast(`✖ ${exec.error}`, "error");
    }
    // only fire once per exec id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exec.status]);

  // Last meaningful message to show
  const lastMsg =
    exec.events.findLast?.((e) => e.message)?.message ??
    exec.events.slice().reverse().find((e) => e.message)?.message;

  const displayText = isError
    ? exec.error
    : isDone
      ? exec.result
      : lastMsg ?? `Running ${exec.command}…`;

  const pct = isRunning ? exec.pct : isDone ? 100 : 0;

  return (
    <div
      className={clsx(
        "w-[260px] rounded-sm border backdrop-blur-sm text-[11px] font-mono overflow-hidden",
        "animate-slide-up transition-all",
        isError
          ? "border-red-500/60 bg-red-950/60 text-red-300"
          : isDone
            ? "border-neon-green/60 bg-neon-green/5 text-neon-green"
            : "border-neon-cyan/50 bg-neon-cyan/5 text-neon-cyan",
      )}
    >
      {/* Progress bar (top strip) */}
      {isRunning && (
        <div className="h-0.5 w-full bg-white/10">
          <div
            className="h-full bg-neon-cyan/80 transition-all duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {isDone && <div className="h-0.5 w-full bg-neon-green/60" />}
      {isError && <div className="h-0.5 w-full bg-red-500/60" />}

      <div className="px-3 py-2 flex items-start gap-2">
        {/* Status icon */}
        <span className="shrink-0 mt-px text-[13px] leading-none">
          {isRunning ? (
            <span className="inline-block animate-spin-slow">◌</span>
          ) : isDone ? (
            "✔"
          ) : (
            "✖"
          )}
        </span>

        <div className="flex-1 min-w-0">
          {/* Command label */}
          <div
            className={clsx(
              "pixel text-[9px] tracking-widest mb-0.5 uppercase",
              isError ? "text-red-400" : "text-white/50",
            )}
          >
            {exec.command}
            {exec.agentId && (
              <span className="ml-1 text-neon-purple/70">→ {exec.agentId.toUpperCase()}</span>
            )}
          </div>

          {/* Current message */}
          <div className="truncate leading-tight">{displayText}</div>

          {/* Duration on done */}
          {(isDone || isError) && exec.finishedAt && (
            <div className="text-[9px] text-white/30 mt-0.5">
              {exec.finishedAt - exec.startedAt}ms
            </div>
          )}
        </div>

        {/* Dismiss button on finished */}
        {(isDone || isError) && (
          <button
            onClick={() => executionBus.dismiss(exec.id)}
            className="shrink-0 text-[10px] text-white/30 hover:text-white/70 transition mt-px"
            title="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

// ── Host ──────────────────────────────────────────────────────────────────────

/**
 * Place once near the bottom of your app (above ToastHost z-index).
 * Renders all active executions as stacked live-progress toasts.
 */
export function ExecutionToastHost() {
  const executions = useSyncExternalStore(
    (cb) => executionBus.subscribe(cb),
    () => executionBus.getAll(),
    () => [] as ActiveExecution[],
  );

  if (executions.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-28 left-4 z-[69] flex flex-col gap-2"
      aria-live="polite"
      aria-label="Execution status"
    >
      {executions.map((exec) => (
        <div key={exec.id} className="pointer-events-auto">
          <ExecToast exec={exec} />
        </div>
      ))}
    </div>
  );
}
