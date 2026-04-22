"use client";

import { useEffect, useRef, useState } from "react";
import { X, Power, RotateCcw, Trash2, Download } from "lucide-react";
import { AGENTS } from "@/lib/agents";
import { useAgent } from "@/lib/useAgent";
import { blockifyTranscript } from "@/lib/blockify";
import { ConsoleBlock } from "./ConsoleBlock";
import { cn } from "@/lib/cn";

interface AgentConsoleProps {
  sessionId: string;
  agentId: string;
  onClose?: () => void;
}

const ACCENT_MAP: Record<string, string> = {
  ultron: "text-cyan-400",
  nova: "text-emerald-400",
  forge: "text-orange-400",
  ares: "text-rose-400",
  echo: "text-cyan-400",
  midas: "text-amber-400",
};

const BORDER_MAP: Record<string, string> = {
  ultron: "border-cyan-400/30",
  nova: "border-emerald-400/30",
  forge: "border-orange-400/30",
  ares: "border-rose-400/30",
  echo: "border-cyan-400/30",
  midas: "border-amber-400/30",
};

export function AgentConsole({ sessionId, agentId, onClose }: AgentConsoleProps) {
  const agent = AGENTS[agentId];
  const { transcript, liveEvents, status, send, kill, restart, clear } = useAgent(
    sessionId,
    agentId,
  );

  const [input, setInput] = useState("");
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const blocks = blockifyTranscript(transcript);

  const liveAssistantText = liveEvents
    .filter((e) => e.kind === "assistant_text")
    .map((e) => (e as { text: string }).text)
    .join("");

  const liveToolEvents = liveEvents.filter(
    (e) => e.kind === "tool_use" || e.kind === "tool_result",
  );

  const liveStatus = liveEvents
    .filter((e) => e.kind === "status")
    .map((e) => (e as { message: string }).message)
    .pop();

  const liveError = liveEvents
    .filter((e) => e.kind === "error")
    .map((e) => (e as { message: string }).message)
    .pop();

  useEffect(() => {
    if (!autoScroll || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [blocks, liveEvents, autoScroll]);

  const handleSend = async () => {
    if (!input.trim() || status === "dead") return;
    try {
      await send(input);
      setInput("");
    } catch (err) {
      console.error("[AgentConsole] send failed:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      handleSend();
    }
  };

  const handleExport = () => {
    const ndjson = transcript
      .map((e) => JSON.stringify(e))
      .join("\n");

    const blob = new Blob([ndjson], { type: "application/x-ndjson" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sessionId}.ndjson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyBlock = (blockIndex: number) => {
    const block = blocks[blockIndex];
    const text = [
      block.userInput ? `$ ${block.userInput}` : "",
      block.outputs
        .filter((e) => e.kind === "stdout" || e.kind === "stderr")
        .map((e) => e.data)
        .join("\n"),
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text).catch(console.error);
  };

  return (
    <div
      className={cn(
        "flex flex-col h-full rounded-lg border bg-black/40 backdrop-blur-md",
        BORDER_MAP[agentId] || "border-white/10",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="text-lg">{agent?.emoji}</span>
          <span className={cn("font-mono font-bold", ACCENT_MAP[agentId])}>
            {agent?.name}
          </span>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded font-mono",
              status === "running" && "bg-emerald-500/20 text-emerald-300",
              status === "idle" && "bg-blue-500/20 text-blue-300",
              status === "error" && "bg-rose-500/20 text-rose-300",
              status === "dead" && "bg-gray-500/20 text-gray-300",
              status === "spawning" && "bg-amber-500/20 text-amber-300",
            )}
          >
            {status}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handleExport}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Export as NDJSON"
          >
            <Download className="w-4 h-4 text-white/60" />
          </button>

          <button
            onClick={() => clear()}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Clear transcript"
          >
            <Trash2 className="w-4 h-4 text-white/60" />
          </button>

          <button
            onClick={() => restart()}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Restart agent"
          >
            <RotateCcw className="w-4 h-4 text-white/60" />
          </button>

          <button
            onClick={() => kill()}
            className="p-2 hover:bg-white/10 rounded transition-colors"
            title="Kill agent"
          >
            <Power className="w-4 h-4 text-white/60" />
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded transition-colors"
            >
              <X className="w-4 h-4 text-white/60" />
            </button>
          )}
        </div>
      </div>

      {/* Scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2"
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom =
            el.scrollHeight - el.scrollTop - el.clientHeight < 80;
          setAutoScroll(atBottom);
        }}
      >
        {blocks.length === 0 && liveEvents.length === 0 ? (
          <div className="text-center text-white/40 py-8">
            No output yet. Send a command to get started.
          </div>
        ) : (
          blocks.map((block, i) => (
            <ConsoleBlock
              key={i}
              userInput={block.userInput}
              outputs={block.outputs}
              status={block.status}
              onCopy={() => handleCopyBlock(i)}
            />
          ))
        )}

        {status === "running" && (
          <div className="rounded border border-white/10 bg-white/[0.02] p-3 space-y-2">
            {liveToolEvents.map((ev, i) => (
              <div
                key={i}
                className="font-mono text-[11px] text-white/60 border-l-2 border-cyan-400/40 pl-2"
              >
                {ev.kind === "tool_use" ? (
                  <>
                    <span className="text-cyan-300">▸ {ev.name}</span>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-white/40">
                      {JSON.stringify(ev.input, null, 2).slice(0, 500)}
                    </pre>
                  </>
                ) : (
                  <>
                    <span
                      className={cn(
                        ev.isError ? "text-rose-300" : "text-emerald-300",
                      )}
                    >
                      ◂ result{ev.isError ? " (error)" : ""}
                    </span>
                    <pre className="mt-1 whitespace-pre-wrap break-all text-white/40">
                      {ev.output.slice(0, 500)}
                    </pre>
                  </>
                )}
              </div>
            ))}
            {liveAssistantText && (
              <pre
                className={cn(
                  "whitespace-pre-wrap font-mono text-sm text-white/90",
                  ACCENT_MAP[agentId],
                )}
              >
                {liveAssistantText}
                <span className="animate-pulse">▋</span>
              </pre>
            )}
            {!liveAssistantText && !liveToolEvents.length && (
              <div className="font-mono text-xs text-white/40 italic">
                {liveStatus ?? "thinking…"}
              </div>
            )}
            {liveError && (
              <div className="font-mono text-xs text-rose-300">
                error: {liveError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer — Input */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type command... (Ctrl+Enter to send)"
            disabled={status === "dead"}
            className={cn(
              "flex-1 bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder:text-white/40",
              "focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/10",
              "resize-none",
              status === "dead" && "opacity-50 cursor-not-allowed",
            )}
            rows={2}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || status === "dead"}
            className={cn(
              "px-4 py-2 rounded font-mono text-sm font-bold whitespace-nowrap transition-colors",
              input.trim() && status !== "dead"
                ? "bg-white/10 hover:bg-white/20 text-white"
                : "bg-white/5 text-white/40 cursor-not-allowed",
            )}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
