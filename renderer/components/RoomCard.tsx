"use client";

import { motion } from "framer-motion";
import clsx from "clsx";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sfx";
import { AGENTS, agentForRoom } from "@/lib/agents";
import { useAgentActivity } from "@/lib/activityStore";
import { useAgentProfile } from "@/lib/profileStore";
import { useLastActivity } from "@/lib/lastActivityStore";
import { levelFromCounters, rankFromLevel, progressInLevel, xpValue } from "@/lib/rank";
import { RoomScene } from "./rooms/RoomScenes";

type Room = {
  id: string;
  name: string;
  color: string;
  agent: string | null;
  emoji: string;
};

const ACCENT_MAP: Record<string, string> = {
  ultron: "cyan-400",
  nova: "fuchsia-400",
  forge: "orange-400",
  ares: "red-400",
  echo: "emerald-400",
  midas: "amber-400",
};

export function RoomCard({
  room,
  isHovered,
  onHover,
  onEnter,
}: {
  room: Room;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onEnter: (agentId: string) => void;
}) {
  const agent = agentForRoom(room.name);
  const activity = useAgentActivity(agent.id);
  const profile = useAgentProfile(agent.id);
  const lastAct = useLastActivity(agent.id);
  const working = activity === "working";
  const errored = activity === "error";
  const delegatorName = lastAct?.delegatedFrom
    ? AGENTS[lastAct.delegatedFrom]?.name ?? lastAct.delegatedFrom.toUpperCase()
    : null;
  const level = levelFromCounters(profile.messagesSent, profile.toolsUsed);
  const rank = rankFromLevel(level);
  const xp = xpValue(profile.messagesSent, profile.toolsUsed);
  const prog = progressInLevel(xp, level);
  const accentColor = ACCENT_MAP[agent.id] || "cyan-400";

  return (
    <motion.button
      type="button"
      onMouseEnter={() => {
        onHover(room.id);
        sfx.hover();
      }}
      onMouseLeave={() => onHover(null)}
      onClick={() => {
        sfx.select();
        onEnter(agent.id);
      }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md p-5 text-left transition-colors",
        "hover:border-white/20",
        working && "animate-alarm-border",
        errored && "ring-2 ring-neon-red/70",
      )}
      style={{
        color: room.color,
        boxShadow:
          working
            ? `0 0 22px ${room.color}, 0 0 44px ${room.color}88, inset 0 0 36px ${room.color}44`
            : isHovered
              ? `0 0 16px ${room.color}, inset 0 0 28px ${room.color}33`
              : undefined,
      }}
    >
      {/* Glass overlay gradient (accent color) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `radial-gradient(ellipse at 100% 0%, ${room.color}14, transparent 70%)`,
        }}
      />

      {/* Tactical corner bracket */}
      <svg
        className="absolute top-2 right-2 w-4 h-4 opacity-20 group-hover:opacity-40 transition-opacity"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path d="M 12 2 L 2 2 L 2 4 M 12 2 L 12 4" />
      </svg>
      {/* Header */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "text-xl drop-shadow-[0_0_6px_currentColor]",
              working && "animate-shake",
            )}
          >
            {room.emoji}
          </span>
          <div>
            <div className="pixel text-[10px] tracking-[0.15em]" style={{ color: room.color }}>
              {room.name}
            </div>
            <div className="text-[8px] uppercase flex items-center gap-1">
              <span
                className="pixel rounded-sm border px-1 py-[1px] tracking-widest"
                style={{ borderColor: rank.color, color: rank.color, background: `${rank.color}12` }}
              >
                L{level} · {rank.label}
              </span>
            </div>
          </div>
        </div>
        <StatusBadge working={working} errored={errored} color={room.color} online={true} />
      </div>

      {/* Room scene */}
      <RoomScene
        agentId={agent.id}
        color={room.color}
        working={working}
        errored={errored}
      />

      {/* Delegation-in badge */}
      {delegatorName && (
        <div className="absolute left-2 top-14 z-20 rounded-sm border px-1 py-[1px] pixel text-[8px] tracking-wider"
          style={{ borderColor: room.color, background: `${room.color}22`, color: room.color }}
        >
          ← {delegatorName}
        </div>
      )}

      {/* Live task preview */}
      {working && lastAct && (
        <div className="relative z-10 flex items-center gap-1 font-mono text-[9px] text-white/70">
          <span
            className="rounded-sm border px-1 py-[1px] pixel text-[7px] tracking-widest"
            style={{ borderColor: `${room.color}aa`, color: room.color }}
          >
            {lastAct.tool}
          </span>
          <span className="truncate">{lastAct.target || "…"}</span>
        </div>
      )}

      {/* XP bar */}
      <div className="relative z-10">
        <div className="h-1 overflow-hidden rounded-sm border border-white/10 bg-black/60">
          <div
            className="h-full transition-all"
            style={{
              width: `${prog * 100}%`,
              background: `linear-gradient(90deg, ${room.color}, ${rank.color})`,
              boxShadow: `0 0 6px ${room.color}`,
            }}
          />
        </div>
        <div className="mt-0.5 flex justify-between text-[7px] text-white/40">
          <span>{profile.messagesSent} msgs · {profile.toolsUsed} tools</span>
          <span>XP {xp}</span>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between">
        <div className="text-[9px] uppercase text-white/60">
          {working ? (
            <span className="flex items-center gap-1 text-neon-yellow">
              <span className="h-1.5 w-1.5 animate-ping rounded-full bg-neon-yellow" />
              EXECUTING TASK...
            </span>
          ) : room.agent ? (
            <>
              <span className="text-white/40">AGT:</span>{" "}
              <span style={{ color: room.color }}>{room.agent}</span>
            </>
          ) : (
            <span className="text-white/30">Empty slot</span>
          )}
        </div>
        <span
          className="rounded-sm border px-1.5 py-0.5 text-[9px] uppercase tracking-wider opacity-80 group-hover:opacity-100"
          style={{ borderColor: `${room.color}99`, color: room.color }}
        >
          ENTER ►
        </span>
      </div>
    </motion.button>
  );
}

function StatusBadge({
  working,
  errored,
  color,
  online,
}: {
  working: boolean;
  errored: boolean;
  color: string;
  online: boolean;
}) {
  const label = errored ? "ERROR" : working ? "WORKING" : online ? "ONLINE" : "IDLE";
  const dot = errored ? "#ff3a5e" : working ? "#22ff88" : online ? color : "#999";
  return (
    <div
      className={clsx(
        "flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[8px] uppercase",
        working && "animate-pulse bg-neon-green/10 border-neon-green/70 text-neon-green",
      )}
      style={!working ? { borderColor: `${color}66`, color } : undefined}
    >
      <span
        className={clsx(
          "h-1 w-1 rounded-full",
          online && "animate-pulse",
        )}
        style={{
          background: dot,
          boxShadow: `0 0 6px ${dot}`,
        }}
      />
      {label}
    </div>
  );
}
