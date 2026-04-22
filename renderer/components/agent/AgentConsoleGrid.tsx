"use client";

import { useEffect, useState } from "react";
import { Play, Power, Trash2, Download } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { useAgentList } from "@/lib/useAgentList";
import { AgentConsole } from "./AgentConsole";
import { cn } from "@/lib/cn";

interface AgentConsoleGridProps {
  visible: boolean;
  onClose?: () => void;
}

const AGENT_IDS = ["ultron", "nova", "forge", "ares", "echo", "midas"];

const BORDER_MAP: Record<string, string> = {
  ultron: "border-cyan-400/30",
  nova: "border-emerald-400/30",
  forge: "border-orange-400/30",
  ares: "border-rose-400/30",
  echo: "border-cyan-400/30",
  midas: "border-amber-400/30",
};

export function AgentConsoleGrid({ visible, onClose }: AgentConsoleGridProps) {
  const runtimes = useAgentList();
  const [minimized, setMinimized] = useState<Set<string>>(new Set());

  // Create map of sessionId by agentId
  const runtimesByAgent = new Map(
    runtimes.map((r) => [r.agentId, r]),
  );

  const handleSpawnAll = async () => {
    if (!window.ultronos?.agent) return;
    for (const agentId of AGENT_IDS) {
      const existing = runtimesByAgent.get(agentId);
      if (!existing) {
        try {
          await window.ultronos.agent.spawn(agentId);
        } catch (err) {
          console.error(`[AgentConsoleGrid] spawn ${agentId} failed:`, err);
        }
      }
    }
  };

  const handleKillAll = async () => {
    if (!window.ultronos?.agent) return;
    for (const runtime of runtimes) {
      try {
        await window.ultronos.agent.kill(runtime.sessionId);
      } catch (err) {
        console.error(`[AgentConsoleGrid] kill ${runtime.sessionId} failed:`, err);
      }
    }
  };

  const handleClearAll = async () => {
    if (!window.ultronos?.agent) return;
    for (const runtime of runtimes) {
      try {
        await window.ultronos.agent.clear(runtime.sessionId);
      } catch (err) {
        console.error(`[AgentConsoleGrid] clear ${runtime.sessionId} failed:`, err);
      }
    }
  };

  const handleExportAll = () => {
    const allData = runtimes
      .map((r) => ({
        agentId: r.agentId,
        sessionId: r.sessionId,
        createdAt: r.createdAt,
      }))
      .map((item) => JSON.stringify(item))
      .join("\n");

    const blob = new Blob([allData], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "agents-export.ndjson";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h1 className="text-2xl font-bold text-white">
          Agent Console 🤖
        </h1>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSpawnAll}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded font-mono text-sm",
              "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition-colors",
            )}
            title="Spawn all agents"
          >
            <Play className="w-4 h-4" />
            Spawn All
          </button>

          <button
            onClick={handleClearAll}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded font-mono text-sm",
              "bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors",
            )}
            title="Clear all transcripts"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>

          <button
            onClick={handleExportAll}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded font-mono text-sm",
              "bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 transition-colors",
            )}
            title="Export all"
          >
            <Download className="w-4 h-4" />
            Export All
          </button>

          <button
            onClick={handleKillAll}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded font-mono text-sm",
              "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-colors",
            )}
            title="Kill all agents"
          >
            <Power className="w-4 h-4" />
            Kill All
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="ml-4 px-4 py-2 rounded font-mono text-sm bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-min h-fit">
          {AGENT_IDS.map((agentId) => {
            const agent = AGENTS[agentId];
            const runtime = runtimesByAgent.get(agentId);
            const isMini = minimized.has(agentId);

            if (!runtime) {
              // Not spawned — show placeholder
              return (
                <div
                  key={agentId}
                  className={cn(
                    "rounded-lg border bg-black/40 backdrop-blur-md p-4",
                    BORDER_MAP[agentId] || "border-white/10",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{agent?.emoji}</span>
                      <span className="font-mono font-bold text-white/60">
                        {agent?.name}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-white/40">Not spawned</p>
                  <button
                    onClick={() => {
                      if (window.ultronos?.agent) {
                        window.ultronos.agent.spawn(agentId).catch(console.error);
                      }
                    }}
                    className="mt-2 w-full px-3 py-1 rounded text-xs bg-white/10 hover:bg-white/20 text-white transition-colors"
                  >
                    Spawn
                  </button>
                </div>
              );
            }

            return (
              <div
                key={agentId}
                className={cn(
                  "rounded-lg border bg-black/40 backdrop-blur-md overflow-hidden",
                  BORDER_MAP[agentId] || "border-white/10",
                  isMini ? "h-auto" : "h-96",
                )}
              >
                {isMini ? (
                  <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
                    <span className="text-sm font-mono">
                      {agent?.emoji} {agent?.name} (minimized)
                    </span>
                    <button
                      onClick={() =>
                        setMinimized((s) => {
                          const n = new Set(s);
                          n.delete(agentId);
                          return n;
                        })
                      }
                      className="text-xs px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                    >
                      Show
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        setMinimized((s) => new Set(s).add(agentId))
                      }
                      className="w-full text-xs px-2 py-1 rounded-t bg-white/5 hover:bg-white/10 text-white/60 transition-colors"
                    >
                      Min
                    </button>
                    <AgentConsole
                      sessionId={runtime.sessionId}
                      agentId={agentId}
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
