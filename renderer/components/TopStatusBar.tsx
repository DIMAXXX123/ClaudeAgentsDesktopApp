"use client";

import { useEffect, useState } from "react";
import { sfx } from "@/lib/sfx";
import { useAnyActivity } from "@/lib/activityStore";
import { AGENTS } from "@/lib/agents";
import { useAutofixState } from "@/lib/autofixStore";
import { triggerAutofixNow } from "@/lib/useAutofixLoop";

function formatAgo(ts: number | null): string {
  if (!ts) return "never";
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export function TopStatusBar({
  onOpenPalette,
  onOpenMemory,
}: {
  onOpenPalette: () => void;
  onOpenMemory: () => void;
}) {
  const activity = useAnyActivity();
  const autofix = useAutofixState();
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const workingIds = Object.entries(activity)
    .filter(([, v]) => v === "working")
    .map(([k]) => k);
  const erroredIds = Object.entries(activity)
    .filter(([, v]) => v === "error")
    .map(([k]) => k);

  return (
    <div className="flex items-center justify-between border-b border-neon-purple/40 bg-gradient-to-b from-[#1b0f3a]/90 to-[#0a0520]/90 px-4 py-2 backdrop-blur-sm">
      {/* Left: brand */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan shadow-neon-cyan">
          <span className="pixel text-xs">◤◢</span>
        </div>
        <div className="pixel text-sm tracking-[0.3em] text-neon-cyan [text-shadow:_0_0_8px_#22e8ff]">
          ULTRONOS
        </div>
        <div className="hidden items-center gap-1 rounded-sm border border-neon-green/40 bg-neon-green/10 px-2 py-0.5 text-[10px] uppercase text-neon-green md:flex">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-neon-green" />
          {Object.keys(AGENTS).length} agents online
        </div>
      </div>

      {/* Center: active work */}
      <div className="hidden items-center gap-3 font-mono text-[11px] uppercase tracking-widest md:flex">
        {workingIds.length > 0 ? (
          <div className="flex items-center gap-2 rounded-sm border border-neon-yellow/60 bg-neon-yellow/10 px-2 py-1 text-neon-yellow animate-pulse">
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-neon-yellow" />
            {workingIds.length} working
            <span className="text-white/50">·</span>
            <span className="text-white/80">
              {workingIds.map((id) => AGENTS[id]?.name).filter(Boolean).join(", ")}
            </span>
          </div>
        ) : (
          <div className="rounded-sm border border-white/20 bg-white/5 px-2 py-1 text-white/50">
            all idle
          </div>
        )}
        {erroredIds.length > 0 && (
          <div className="rounded-sm border border-neon-red/60 bg-neon-red/10 px-2 py-1 text-neon-red">
            {erroredIds.length} error
          </div>
        )}
      </div>

      {/* Right: autofix + palette + mute */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => triggerAutofixNow()}
          disabled={autofix.running}
          className={`rounded-sm border px-2 py-1 text-[10px] uppercase transition ${
            autofix.running
              ? "border-neon-yellow/70 bg-neon-yellow/10 text-neon-yellow animate-pulse"
              : autofix.unfixed > 0
                ? "border-neon-red/60 bg-neon-red/10 text-neon-red hover:border-neon-red"
                : "border-white/20 bg-white/5 text-white/50 hover:border-neon-green/60 hover:text-neon-green"
          }`}
          title="Run autofix now"
        >
          {autofix.running
            ? "⚙ fixing…"
            : `⚙ ${autofix.unfixed} bug${autofix.unfixed === 1 ? "" : "s"} · ${formatAgo(autofix.lastRunAt)}`}
        </button>
        <button
          onClick={onOpenMemory}
          className="rounded-sm border border-neon-purple/40 bg-neon-purple/10 px-2 py-1 text-[10px] uppercase text-neon-purple hover:border-neon-purple hover:text-white"
          title="Memory core (Ctrl+M)"
        >
          ▥ MEM
        </button>
        <a
          href="/galaxy"
          className="rounded-sm border border-neon-cyan/40 bg-neon-cyan/10 px-2 py-1 text-[10px] uppercase text-neon-cyan hover:border-neon-cyan hover:text-white"
          title="Memory galaxy"
        >
          ✦ GALAXY
        </a>
        <button
          onClick={onOpenPalette}
          className="rounded-sm border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase text-white/60 hover:border-neon-cyan/60 hover:text-neon-cyan"
        >
          ⌘K
        </button>
        <MuteButton />
      </div>
    </div>
  );
}

function MuteButton() {
  const [muted, setMuted] = useState(false);
  return (
    <button
      onClick={() => {
        const m = sfx.toggleMute();
        setMuted(m);
        if (!m) sfx.select();
      }}
      className={`rounded-sm border px-2 py-1 text-[10px] uppercase transition ${
        muted
          ? "border-white/20 bg-white/5 text-white/50"
          : "border-neon-green/60 bg-neon-green/10 text-neon-green"
      }`}
      title={muted ? "Unmute SFX" : "Mute SFX"}
    >
      {muted ? "🔇" : "🔊"}
    </button>
  );
}
