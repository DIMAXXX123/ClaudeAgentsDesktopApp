"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Command, MemoryStick, Grid3x3, Settings2, Zap } from "lucide-react";
import { uiEventBus } from "@/lib/uiEventBus";
import { AGENTS, type AgentSpec } from "@/lib/agents";
import { cn } from "@/lib/cn";

interface Section {
  id: string;
  label: string;
  color: string;
  expanded: boolean;
}

export function CapabilitiesPanel() {
  const [sections, setSections] = useState<Record<string, boolean>>({
    quick: true,
    agents: true,
    shortcuts: false,
    services: true,
    recent: true,
  });

  const [recentChats, setRecentChats] = useState<Array<{ id: string; name: string }>>([]);
  const [listenerConnected, setListenerConnected] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("ultronos.panels.sections");
    if (stored) {
      try {
        setSections(JSON.parse(stored));
      } catch {}
    }
  }, []);

  useEffect(() => {
    const saveSections = () => localStorage.setItem("ultronos.panels.sections", JSON.stringify(sections));
    saveSections();
  }, [sections]);

  useEffect(() => {
    try {
      const recent = localStorage.getItem("ultronos.recent.chats");
      if (recent) {
        setRecentChats(JSON.parse(recent).slice(0, 5));
      }
    } catch {}

    setListenerConnected(!!window.ultronos?.listener);
  }, []);

  const toggleSection = (id: string) => {
    setSections((p) => ({ ...p, [id]: !p[id] }));
  };

  const agentList = Object.values(AGENTS).slice(0, 6) as AgentSpec[];

  const sectionClasses = "rounded-lg border border-cyan-400/15 bg-[#05070d]/80 backdrop-blur-sm p-3";
  const headerClasses = "text-[9px] uppercase tracking-[0.2em] font-mono font-bold";

  return (
    <div className="h-full flex flex-col gap-2 overflow-auto pb-4">
      <div className="text-[10px] uppercase tracking-[0.35em] text-cyan-400/70 px-1 pt-2">
        ⚡ Capabilities
      </div>

      {/* Quick Actions */}
      <Section
        id="quick"
        label="Quick Actions"
        expanded={sections.quick}
        onToggle={() => toggleSection("quick")}
        color="cyan"
      >
        <div className="flex flex-col gap-1">
          {[
            { label: "Palette", shortcut: "Ctrl+K", action: () => uiEventBus.emitOpenPalette() },
            { label: "Memory", shortcut: "Ctrl+M", action: () => uiEventBus.emitOpenMemory() },
            { label: "Galaxy", shortcut: "Ctrl+G", action: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "g", ctrlKey: true })) },
            { label: "Settings", shortcut: "Ctrl+,", action: () => uiEventBus.emitOpenSettings() },
          ].map((btn) => (
            <button
              key={btn.label}
              onClick={btn.action}
              className="group flex items-center justify-between rounded border border-cyan-400/20 bg-cyan-400/5 px-2 py-1.5 text-[8px] uppercase transition hover:border-cyan-400/50 hover:bg-cyan-400/15"
            >
              <span>{btn.label}</span>
              <span className="text-[7px] text-cyan-400/40 group-hover:text-cyan-400/70">{btn.shortcut}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Agents */}
      <Section
        id="agents"
        label="Agents"
        expanded={sections.agents}
        onToggle={() => toggleSection("agents")}
        color="magenta"
      >
        <div className="flex flex-col gap-1">
          {agentList.map((agent) => (
            <AgentButton key={agent.id} agent={agent} />
          ))}
        </div>
      </Section>

      {/* Shortcuts */}
      <Section
        id="shortcuts"
        label="Shortcuts"
        expanded={sections.shortcuts}
        onToggle={() => toggleSection("shortcuts")}
        color="orange"
      >
        <div className="space-y-1.5 text-[7px]">
          {[
            "Ctrl+K — Command Palette",
            "Ctrl+M — Memory Panel",
            "Ctrl+G — Galaxy View",
            "Ctrl+, — Settings",
            "Tab — Switch panels",
          ].map((s) => (
            <div key={s} className="text-white/40">
              {s}
            </div>
          ))}
        </div>
      </Section>

      {/* Services */}
      <Section
        id="services"
        label="Services"
        expanded={sections.services}
        onToggle={() => toggleSection("services")}
        color="green"
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded border border-emerald-400/20 bg-emerald-400/5 px-2 py-2">
            <div className="flex items-center gap-2">
              <div className={cn("h-2 w-2 rounded-full", listenerConnected ? "bg-emerald-400" : "bg-gray-600")} />
              <span className="text-[8px] uppercase">TG Listener</span>
            </div>
            <button className="text-[7px] text-emerald-400/60 hover:text-emerald-400">
              {listenerConnected ? "Stop" : "Start"}
            </button>
          </div>
        </div>
      </Section>

      {/* Recent */}
      {recentChats.length > 0 && (
        <Section
          id="recent"
          label="Recent"
          expanded={sections.recent}
          onToggle={() => toggleSection("recent")}
          color="yellow"
        >
          <div className="flex flex-col gap-1">
            {recentChats.map((chat) => (
              <button
                key={chat.id}
                className="rounded border border-yellow-400/15 bg-yellow-400/5 px-2 py-1.5 text-left text-[8px] uppercase transition hover:border-yellow-400/40 hover:bg-yellow-400/10"
              >
                {chat.name.slice(0, 20)}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

interface SectionProps {
  id: string;
  label: string;
  expanded: boolean;
  onToggle: () => void;
  color: "cyan" | "magenta" | "orange" | "green" | "yellow";
  children: React.ReactNode;
}

function Section({ label, expanded, onToggle, color, children }: SectionProps) {
  const colorMap = {
    cyan: "border-cyan-400/15 bg-[#05070d]/80",
    magenta: "border-fuchsia-400/15 bg-[#05070d]/80",
    orange: "border-orange-400/15 bg-[#05070d]/80",
    green: "border-emerald-400/15 bg-[#05070d]/80",
    yellow: "border-yellow-400/15 bg-[#05070d]/80",
  };

  const textColorMap = {
    cyan: "text-cyan-400/70",
    magenta: "text-fuchsia-400/70",
    orange: "text-orange-400/70",
    green: "text-emerald-400/70",
    yellow: "text-yellow-400/70",
  };

  return (
    <div className={cn("rounded-lg border backdrop-blur-sm p-3", colorMap[color])}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 mb-2"
      >
        <div className={cn("text-[9px] uppercase tracking-[0.2em] font-mono font-bold", textColorMap[color])}>
          {label}
        </div>
        <ChevronDown
          size={12}
          className={cn("transition-transform", textColorMap[color], expanded ? "rotate-0" : "-rotate-90")}
        />
      </button>
      {expanded && <div className="space-y-1">{children}</div>}
    </div>
  );
}

interface AgentButtonProps {
  agent: AgentSpec;
}

function AgentButton({ agent }: AgentButtonProps) {
  const colorMap: Record<string, string> = {
    "#22e8ff": "border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/15",
    "#22ff88": "border-emerald-400/30 bg-emerald-400/5 hover:bg-emerald-400/15",
    "#ffae3a": "border-orange-400/30 bg-orange-400/5 hover:bg-orange-400/15",
    "#ff4adf": "border-fuchsia-400/30 bg-fuchsia-400/5 hover:bg-fuchsia-400/15",
    "#06b6d4": "border-cyan-400/30 bg-cyan-400/5 hover:bg-cyan-400/15",
    "#f5d64a": "border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/15",
  };

  return (
    <button
      className={cn(
        "flex items-center gap-2 rounded border px-2 py-1.5 text-left text-[8px] uppercase transition",
        colorMap[agent.color] || "border-white/10 hover:bg-white/5"
      )}
    >
      <div className="h-1.5 w-1.5 rounded-full bg-white/40" />
      <span className="flex-1">{agent.name}</span>
      <span className="text-[7px] text-white/30">{agent.emoji}</span>
    </button>
  );
}
