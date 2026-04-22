"use client";

import { useState } from "react";
import { ChevronDown, Copy, RotateCcw, Pin, Share2 } from "lucide-react";
import type { TranscriptEvent } from "@/types/ultronos";
import { ansiToHtml } from "@/lib/ansi";
import { cn } from "@/lib/cn";

interface ConsoleBlockProps {
  userInput?: string;
  outputs: TranscriptEvent[];
  status: "pending" | "done" | "error";
  onCopy: () => void;
  onRerun?: () => void;
  onPin?: () => void;
  onShare?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "border-l-amber-400",
  done: "border-l-emerald-400",
  error: "border-l-rose-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Running...",
  done: "Complete",
  error: "Error",
};

export function ConsoleBlock({
  userInput,
  outputs,
  status,
  onCopy,
  onRerun,
  onPin,
  onShare,
}: ConsoleBlockProps) {
  const [expanded, setExpanded] = useState(true);
  const timestamp = outputs[0]?.ts ? new Date(outputs[0].ts).toLocaleTimeString() : "";

  // Hide output if > 50 lines
  const outputLines = outputs
    .filter((e) => e.kind === "stdout" || e.kind === "stderr" || e.kind === "status")
    .map((e) => e.data)
    .join("\n")
    .split("\n");

  const isCompressed = outputLines.length > 50;
  const displayLines = isCompressed ? outputLines.slice(0, 50) : outputLines;
  const hiddenCount = isCompressed ? outputLines.length - 50 : 0;

  return (
    <div
      className={cn(
        "rounded-lg border-l-4 border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden transition-all",
        STATUS_COLORS[status],
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex-shrink-0 p-1 hover:bg-white/10 rounded transition-colors"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform",
                !expanded && "-rotate-90",
              )}
            />
          </button>

          <div className="flex-1 min-w-0">
            {userInput && (
              <code className="text-sm text-cyan-300/80 truncate block">
                {userInput}
              </code>
            )}
            <span className="text-xs text-white/40">{timestamp}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <span className={cn(
            "text-xs px-2 py-1 rounded font-mono",
            status === "done" && "bg-emerald-500/20 text-emerald-300",
            status === "error" && "bg-rose-500/20 text-rose-300",
            status === "pending" && "bg-amber-500/20 text-amber-300",
          )}>
            {STATUS_LABELS[status]}
          </span>

          <button
            onClick={onCopy}
            className="p-1.5 hover:bg-white/10 rounded transition-colors"
            title="Copy output"
          >
            <Copy className="w-4 h-4 text-white/60 hover:text-white/80" />
          </button>

          {onRerun && (
            <button
              onClick={onRerun}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Re-run command"
            >
              <RotateCcw className="w-4 h-4 text-white/60 hover:text-white/80" />
            </button>
          )}

          {onPin && (
            <button
              onClick={onPin}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Pin block"
            >
              <Pin className="w-4 h-4 text-white/60 hover:text-white/80" />
            </button>
          )}

          {onShare && (
            <button
              onClick={onShare}
              className="p-1.5 hover:bg-white/10 rounded transition-colors"
              title="Share to Telegram"
            >
              <Share2 className="w-4 h-4 text-white/60 hover:text-white/80" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="px-4 py-3">
          <pre className="text-xs font-mono text-white/70 overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
            {displayLines.map((line, i) => (
              <div
                key={i}
                dangerouslySetInnerHTML={{ __html: ansiToHtml(line) }}
              />
            ))}
          </pre>

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded(true)}
              className="text-xs text-cyan-400 hover:underline mt-2"
            >
              ... {hiddenCount} more lines
            </button>
          )}
        </div>
      )}
    </div>
  );
}
