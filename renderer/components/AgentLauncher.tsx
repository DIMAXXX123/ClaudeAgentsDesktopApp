"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { sfx } from "@/lib/sfx";
import { AGENTS } from "@/lib/agents";
import { useCustomAgents } from "@/lib/rooms/customAgents";
import { AddAgentModal } from "./AddAgentModal";

type LauncherEntry = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  title: string;
};

const PRESETS: LauncherEntry[] = Object.values(AGENTS).map((a) => ({
  id: a.id,
  name: a.name,
  emoji: a.emoji,
  color: a.color,
  title: a.title,
}));

export function AgentLauncher({
  activeIds,
  onLaunch,
}: {
  activeIds: string[];
  onLaunch: (agentId: string) => void;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const customAgents = useCustomAgents();
  const activeSet = new Set(activeIds);

  const entries: LauncherEntry[] = [
    ...PRESETS,
    ...customAgents.map((a) => ({
      id: a.id,
      name: a.name,
      emoji: a.emoji,
      color: a.color,
      title: a.title,
    })),
  ];

  return (
    <section
      aria-label="Agent launcher"
      className="rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-md p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="pixel text-[10px] uppercase tracking-widest text-neon-cyan">
          [LAUNCH CONSOLE]
        </div>
        <div className="text-[9px] uppercase tracking-widest text-white/40">
          {activeIds.length} live · {entries.length} available
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map((e) => {
          const isLive = activeSet.has(e.id);
          return (
            <motion.button
              key={e.id}
              type="button"
              onClick={() => {
                sfx.select?.();
                onLaunch(e.id);
              }}
              onMouseEnter={() => sfx.hover?.()}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className={clsx(
                "group relative flex items-center gap-2 rounded-md border px-3 py-2 text-left transition",
                isLive
                  ? "border-white/30 bg-white/[0.04]"
                  : "border-white/10 bg-black/40 hover:border-white/30",
              )}
              style={
                isLive
                  ? {
                      boxShadow: `0 0 14px ${e.color}66, inset 0 0 14px ${e.color}1f`,
                      borderColor: `${e.color}aa`,
                    }
                  : undefined
              }
              title={isLive ? `${e.name} console open` : `Launch ${e.name} console`}
            >
              <span
                className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  isLive && "animate-pulse",
                )}
                style={{
                  background: isLive ? "#22ff88" : "#3a3f4a",
                  boxShadow: isLive ? "0 0 6px #22ff88" : "none",
                }}
              />
              <span
                className={clsx(
                  "text-base leading-none transition",
                  isLive ? "" : "grayscale opacity-40",
                )}
              >
                {e.emoji}
              </span>
              <span
                className={clsx(
                  "pixel text-[10px] tracking-widest transition",
                  !isLive && "text-white/35",
                )}
                style={
                  isLive
                    ? { color: e.color, textShadow: `0 0 6px ${e.color}` }
                    : undefined
                }
              >
                {e.name}
              </span>
              <span
                className={clsx(
                  "text-[9px] uppercase tracking-widest",
                  isLive ? "text-emerald-300" : "text-white/35",
                )}
              >
                {isLive ? "LIVE" : "OFF"}
              </span>
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          onClick={() => {
            sfx.select?.();
            setModalOpen(true);
          }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 rounded-md border border-dashed border-white/20 bg-transparent px-3 py-2 text-white/60 transition hover:border-neon-cyan/60 hover:text-neon-cyan"
          title="Add custom agent"
        >
          <span className="text-base leading-none">+</span>
          <span className="pixel text-[10px] uppercase tracking-widest">
            Add Agent
          </span>
        </motion.button>
      </div>

      <AddAgentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(agent) => onLaunch(agent.id)}
      />
    </section>
  );
}
