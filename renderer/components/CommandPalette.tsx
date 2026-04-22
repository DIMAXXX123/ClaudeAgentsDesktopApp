"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { AGENTS } from "@/lib/agents";
import { listChatSummaries } from "@/lib/chatStore";
import { sfx } from "@/lib/sfx";

export function CommandPalette({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (agentId: string) => void;
}) {
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);

  const summaries = useMemo(() => {
    if (!open) return [];
    return listChatSummaries(Object.keys(AGENTS));
  }, [open]);

  const items = useMemo(() => {
    const lower = q.toLowerCase();
    return Object.values(AGENTS)
      .map((a) => {
        const s = summaries.find((x) => x.agentId === a.id);
        return { agent: a, count: s?.count ?? 0 };
      })
      .filter(
        ({ agent }) =>
          !lower ||
          agent.name.toLowerCase().includes(lower) ||
          agent.room.toLowerCase().includes(lower) ||
          agent.title.toLowerCase().includes(lower),
      );
  }, [q, summaries]);

  useEffect(() => {
    if (open) {
      sfx.open();
      setQ("");
      setIdx(0);
    }
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed top-[20vh] left-1/2 -translate-x-1/2 z-50 w-[min(640px,90vw)]">
          <Command className="rounded-xl border border-cyan-400/30 bg-[#05070d]/95 backdrop-blur-xl shadow-[0_0_60px_rgba(34,211,238,0.25)] overflow-hidden">
            <Command.Input
              placeholder="Summon an agent or run a macro…"
              className="w-full px-3 py-3 bg-transparent text-[13px] text-white placeholder:text-white/40 border-b border-cyan-400/20 focus:outline-none focus:ring-0"
              value={q}
              onValueChange={(value) => {
                setQ(value);
                setIdx(0);
              }}
            />
            <Command.List className="max-h-[50vh] overflow-auto p-1">
              {items.length === 0 && (
                <Command.Empty className="px-3 py-6 text-center text-[11px] text-white/40">
                  no match
                </Command.Empty>
              )}
              {items.map(({ agent, count }, i) => (
                <Command.Item
                  key={agent.id}
                  value={agent.id}
                  onSelect={() => {
                    sfx.select();
                    onPick(agent.id);
                  }}
                  className={clsx(
                    "flex items-center gap-3 rounded-sm px-3 py-2 text-left cursor-pointer transition",
                    "data-[selected=true]:bg-cyan-400/10 data-[selected=true]:text-cyan-100",
                  )}
                  style={{ color: agent.color }}
                >
                  <div className="text-xl shrink-0">{agent.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="pixel text-[11px] tracking-widest">{agent.name}</div>
                    <div className="text-[10px] uppercase text-white/50 truncate">
                      {agent.title} · {agent.room}
                    </div>
                  </div>
                  {count > 0 && (
                    <div className="rounded-sm border border-white/20 px-1.5 py-0.5 text-[9px] text-white/70 shrink-0">
                      {count}
                    </div>
                  )}
                  <span className="text-[10px] text-white/40 shrink-0">↵</span>
                </Command.Item>
              ))}
            </Command.List>
          </Command>
          <div className="flex items-center justify-between border-t border-cyan-400/20 px-3 py-1.5 text-[9px] text-white/40 bg-[#05070d]/60">
            <span>↑↓ navigate · ↵ open · ESC close</span>
            <span>{items.length} agents</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
