"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sfx";

type DiffStats = { files: number; additions: number; deletions: number };

function parseDiffStats(diff: string): DiffStats {
  const lines = diff.split("\n");
  let files = 0;
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.startsWith("diff --git ")) files++;
    else if (line.startsWith("+") && !line.startsWith("+++")) additions++;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions++;
  }
  return { files, additions, deletions };
}

function colorizeLine(line: string): string {
  if (line.startsWith("diff --git ")) return "text-neon-cyan";
  if (line.startsWith("@@")) return "text-neon-magenta";
  if (line.startsWith("+++") || line.startsWith("---")) return "text-white/40";
  if (line.startsWith("+")) return "text-emerald-300";
  if (line.startsWith("-")) return "text-rose-300";
  return "text-white/70";
}

export function AgentDiffModal({
  open,
  onClose,
  agentName,
  agentColor,
  cwd,
}: {
  open: boolean;
  onClose: () => void;
  agentName: string;
  agentColor: string;
  cwd: string | null;
}) {
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !cwd) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDiff("");

    (async () => {
      try {
        const result = await window.ultronos?.worktree.diff(cwd, "HEAD");
        if (cancelled) return;
        if (result?.success && result.data) {
          setDiff(result.data.diff ?? "");
        } else {
          setError(result?.error ?? "Failed to fetch diff");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, cwd]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diff);
      setCopied(true);
      sfx.select?.();
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const stats = diff ? parseDiffStats(diff) : null;
  const lines = diff ? diff.split("\n") : [];

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,900px)] h-[min(85vh,700px)] -translate-x-1/2 -translate-y-1/2 flex flex-col overflow-hidden rounded-xl border bg-slate-950/90 backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95"
          style={{
            borderColor: `${agentColor}66`,
            boxShadow: `0 0 40px ${agentColor}44, inset 0 0 24px ${agentColor}14`,
          }}
        >
          <Dialog.Title className="sr-only">
            Git diff for {agentName}
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Uncommitted changes in the agent worktree
          </Dialog.Description>

          {/* Header */}
          <div
            className="flex items-center justify-between border-b px-5 py-3"
            style={{ borderColor: `${agentColor}33` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="pixel text-[11px] uppercase tracking-widest"
                style={{ color: agentColor, textShadow: `0 0 8px ${agentColor}` }}
              >
                [{agentName} DIFF]
              </div>
              {stats && (stats.files > 0 || stats.additions > 0 || stats.deletions > 0) && (
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="rounded-sm border border-white/15 bg-white/5 px-1.5 py-[1px] text-white/70">
                    {stats.files} file{stats.files === 1 ? "" : "s"}
                  </span>
                  <span className="rounded-sm border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-[1px] text-emerald-300">
                    +{stats.additions}
                  </span>
                  <span className="rounded-sm border border-rose-400/40 bg-rose-400/10 px-1.5 py-[1px] text-rose-300">
                    -{stats.deletions}
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {diff && (
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "rounded-md border border-white/15 bg-white/5 px-2.5 py-1 pixel text-[9px] uppercase tracking-widest text-white/70 transition hover:border-white/30 hover:text-white",
                    copied && "border-emerald-400/50 text-emerald-300",
                  )}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              )}
              <Dialog.Close className="rounded-md p-1 text-white/40 transition hover:bg-white/5 hover:text-white/80">
                <X className="h-4 w-4" />
              </Dialog.Close>
            </div>
          </div>

          {/* cwd */}
          {cwd && (
            <div
              className="border-b px-5 py-1.5 font-mono text-[9px] text-white/40"
              style={{ borderColor: `${agentColor}22` }}
            >
              <span className="text-white/30">cwd:</span> {cwd}
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-auto bg-black/40 p-4">
            {loading && (
              <div className="flex items-center justify-center py-10 pixel text-[10px] uppercase tracking-widest text-white/40">
                <span
                  className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white/20"
                  style={{ borderTopColor: agentColor }}
                />
                Loading diff...
              </div>
            )}
            {!loading && error && (
              <div className="rounded-md border border-rose-400/40 bg-rose-400/10 p-3 font-mono text-[11px] text-rose-300">
                {error}
              </div>
            )}
            {!loading && !error && !diff && (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="mb-2 text-3xl opacity-40">∅</div>
                <div className="pixel text-[10px] uppercase tracking-widest text-white/40">
                  No changes
                </div>
                <div className="mt-1 text-[9px] text-white/30">
                  Worktree matches HEAD
                </div>
              </div>
            )}
            {!loading && !error && diff && (
              <pre className="font-mono text-[11px] leading-relaxed">
                {lines.map((line, i) => (
                  <div key={i} className={colorizeLine(line)}>
                    {line || " "}
                  </div>
                ))}
              </pre>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
