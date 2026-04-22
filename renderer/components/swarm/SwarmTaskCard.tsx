"use client";

import { useState } from "react";
import type { SwarmTask } from "@/lib/swarm/types";

interface SwarmTaskCardProps {
  task: SwarmTask;
}

export function SwarmTaskCard({ task }: SwarmTaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusEmoji: Record<string, string> = {
    pending: "⏳",
    running: "▶️",
    done: "✅",
    failed: "❌",
    skipped: "⊘",
  };

  const statusColor: Record<string, string> = {
    pending: "text-slate-400",
    running: "text-blue-400",
    done: "text-emerald-400",
    failed: "text-rose-400",
    skipped: "text-slate-500",
  };

  const durationMs = task.finishedAt && task.startedAt
    ? task.finishedAt - task.startedAt
    : null;
  const durationSec = durationMs ? (durationMs / 1000).toFixed(2) : null;

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-800 p-3 hover:bg-slate-700 transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-start gap-3"
      >
        <span className={`text-lg ${statusColor[task.status]}`}>
          {statusEmoji[task.status]}
        </span>

        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-slate-100 truncate">
            {task.title}
          </h4>
          <div className="flex gap-2 text-xs text-slate-400 mt-1">
            <span className="inline-block px-2 py-0.5 bg-slate-700 rounded uppercase">
              {task.agentId}
            </span>
            <span className={statusColor[task.status]}>
              {task.status}
            </span>
            {durationSec && (
              <span>{durationSec}s</span>
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-700">
          {/* Prompt */}
          {task.prompt && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Prompt:
              </p>
              <div className="bg-slate-900 p-2 rounded text-xs text-slate-400 max-h-24 overflow-y-auto">
                {task.prompt}
              </div>
            </div>
          )}

          {/* Output */}
          {task.output && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Output:
              </p>
              <div className="bg-slate-900 p-2 rounded text-xs text-slate-300 max-h-32 overflow-y-auto whitespace-pre-wrap">
                {task.output}
              </div>
            </div>
          )}

          {/* Error */}
          {task.error && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-rose-400 mb-1">
                Error:
              </p>
              <div className="bg-rose-900 bg-opacity-30 p-2 rounded text-xs text-rose-300 max-h-24 overflow-y-auto">
                {task.error}
              </div>
            </div>
          )}

          {/* Dependencies */}
          {task.deps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-300 mb-1">
                Deps:
              </p>
              <div className="flex gap-1 flex-wrap">
                {task.deps.map((dep) => (
                  <span
                    key={dep}
                    className="inline-block px-2 py-0.5 bg-slate-700 text-xs text-slate-300 rounded"
                  >
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
