"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sfx";
import { AGENTS } from "@/lib/agents";
import { useCustomAgents } from "@/lib/rooms/customAgents";
import { RoomCard } from "./RoomCard";

export const ROOMS = [
  { id: "bridge", name: "COMMAND BRIDGE", color: "#22e8ff", agent: "ULTRON", emoji: "🛡️" },
  { id: "codex", name: "CODEX ARCHIVE", color: "#22ff88", agent: "NOVA", emoji: "🔬" },
  { id: "foundry", name: "CODE FOUNDRY", color: "#ffae3a", agent: "FORGE", emoji: "🏭" },
  { id: "wardeck", name: "WAR DECK", color: "#ff4adf", agent: "ARES", emoji: "⚔️" },
  { id: "relay", name: "SIGNAL RELAY", color: "#06b6d4", agent: "ECHO", emoji: "📡" },
  { id: "vault", name: "DATA VAULT", color: "#f5d64a", agent: "MIDAS", emoji: "💰" },
];

type Room = {
  id: string;
  name: string;
  color: string;
  agent: string;
  emoji: string;
};

export function RoomGrid({
  activeAgentIds,
  onFocus,
  onClose,
}: {
  activeAgentIds: string[];
  onFocus: (agentId: string) => void;
  onClose: (agentId: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const customAgents = useCustomAgents();

  // Build full room registry (preset + custom), then filter to only active.
  const presetRooms: Room[] = ROOMS;
  const customRooms: Room[] = customAgents.map((agent) => ({
    id: agent.room.replace(/\s+/g, "-").toLowerCase(),
    name: agent.room,
    color: agent.color,
    agent: agent.name,
    emoji: agent.emoji,
  }));
  const allRooms = [...presetRooms, ...customRooms];

  const activeSet = new Set(activeAgentIds);
  // Resolve agentId per room and keep only the active ones.
  const visible = allRooms
    .map((room) => {
      const key = room.name.replace(/\s+/g, "").toLowerCase();
      const agentEntry =
        Object.values(AGENTS).find(
          (a) => a.room.replace(/\s+/g, "").toLowerCase() === key,
        ) ??
        customAgents.find(
          (a) => a.room.replace(/\s+/g, "").toLowerCase() === key,
        );
      return agentEntry ? { room, agentId: agentEntry.id } : null;
    })
    .filter((x): x is { room: Room; agentId: string } => Boolean(x))
    .filter(({ agentId }) => activeSet.has(agentId));

  if (visible.length === 0) {
    return (
      <section>
        <div className="mb-4 pixel text-sm uppercase tracking-widest text-neon-cyan">
          [ACTIVE CONSOLES]
        </div>
        <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] backdrop-blur-md px-6 py-10 text-center">
          <div className="mb-2 text-3xl opacity-40">⌘</div>
          <div className="pixel text-[11px] uppercase tracking-widest text-white/50">
            No consoles online
          </div>
          <div className="mt-2 text-[10px] uppercase tracking-widest text-white/35">
            Launch an agent from the bar above to bring a room online.
          </div>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 pixel text-sm uppercase tracking-widest text-neon-cyan">
        [ACTIVE CONSOLES]
      </div>
      <div className="grid auto-rows-max grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map(({ room, agentId }) => (
          <div key={agentId} className="relative">
            <RoomCard
              room={room}
              isHovered={hovered === room.id}
              onHover={setHovered}
              onEnter={onFocus}
            />
            <motion.button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                sfx.select?.();
                onClose(agentId);
              }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="absolute right-2 top-2 z-20 flex h-6 w-6 items-center justify-center rounded-sm border border-white/30 bg-black/60 text-[11px] text-white/70 backdrop-blur transition hover:border-red-400 hover:text-red-300"
              aria-label={`Close ${room.agent} console`}
              title={`Close ${room.agent} console`}
            >
              ×
            </motion.button>
          </div>
        ))}
      </div>
    </section>
  );
}
