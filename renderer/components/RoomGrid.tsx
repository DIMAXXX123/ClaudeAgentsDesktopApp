"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sfx";
import { RoomCard } from "./RoomCard";
import { AddAgentModal } from "./AddAgentModal";
import { useCustomAgents } from "@/lib/rooms/customAgents";
import type { CustomAgent } from "@/lib/rooms/customAgents";

export const ROOMS = [
  { id: "bridge", name: "COMMAND BRIDGE", color: "#22e8ff", agent: "ULTRON", emoji: "🛡️" },
  { id: "codex", name: "CODEX ARCHIVE", color: "#22ff88", agent: "NOVA", emoji: "🔬" },
  { id: "foundry", name: "CODE FOUNDRY", color: "#ffae3a", agent: "FORGE", emoji: "🏭" },
  { id: "wardeck", name: "WAR DECK", color: "#ff4adf", agent: "ARES", emoji: "⚔️" },
  { id: "relay", name: "SIGNAL RELAY", color: "#06b6d4", agent: "ECHO", emoji: "📡" },
  { id: "vault", name: "DATA VAULT", color: "#f5d64a", agent: "MIDAS", emoji: "💰" },
];

export function RoomGrid({ onEnter }: { onEnter: (agentId: string) => void }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const customAgents = useCustomAgents();

  const handleAgentCreated = (agent: CustomAgent) => {
    onEnter(agent.id);
  };

  // Build room list including custom agents
  const allRooms = [
    ...ROOMS,
    ...customAgents.map((agent) => ({
      id: agent.id,
      name: agent.room,
      color: agent.color,
      agent: agent.name,
      emoji: agent.emoji,
    })),
  ];

  return (
    <section>
      <div className="mb-4 pixel text-sm uppercase tracking-widest text-neon-cyan">
        [STATION LAYOUT]
      </div>
      <div className="grid auto-rows-max grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            isHovered={hovered === room.id}
            onHover={setHovered}
            onEnter={onEnter}
          />
        ))}

        {/* Add Agent Button */}
        <motion.button
          type="button"
          onClick={() => {
            sfx.select?.();
            setModalOpen(true);
          }}
          onMouseEnter={() => {
            setHovered("add-agent");
            sfx.hover?.();
          }}
          onMouseLeave={() => setHovered(null)}
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={cn(
            "group relative flex flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border-2 border-dashed border-white/20 bg-white/[0.01] backdrop-blur-md p-5 text-left transition-colors",
            "hover:border-neon-cyan/50 hover:bg-neon-cyan/5",
            hovered === "add-agent" && "ring-2 ring-neon-cyan/50",
          )}
        >
          {/* Glass overlay gradient */}
          <div
            className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
            style={{
              background: `radial-gradient(ellipse at 100% 0%, #22e8ff14, transparent 70%)`,
            }}
          />

          <div className="relative z-10 text-4xl opacity-50 group-hover:opacity-100 transition-opacity">
            +
          </div>
          <div className="relative z-10 pixel text-xs uppercase tracking-widest text-white/50 group-hover:text-neon-cyan transition-colors">
            Add Agent
          </div>
        </motion.button>
      </div>

      <AddAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={handleAgentCreated}
      />
    </section>
  );
}
