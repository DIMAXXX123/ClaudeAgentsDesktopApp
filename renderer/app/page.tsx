"use client";

import { useEffect, useState } from "react";
import { TitleBarHost } from "@/components/TitleBarHost";
import { RoomGrid } from "@/components/RoomGrid";
import { AgentLauncher } from "@/components/AgentLauncher";
import { SuggestionsPanel } from "@/components/SuggestionsPanel";
import { ChatModal } from "@/components/ChatModal";
import { CommandPalette } from "@/components/CommandPalette";
import { SettingsModal } from "@/components/SettingsModal";
import { MemoryPanel } from "@/components/MemoryPanel";
import { ToastHost } from "@/components/Toast";
import { MemoryGalaxy } from "@/components/MemoryGalaxy";
import { ListenerPanel } from "@/components/ListenerPanel";
import { ConductorPanel } from "@/components/ConductorPanel";
import { CapabilitiesPanel } from "@/components/CapabilitiesPanel";
import { ResizableLayout } from "@/components/ResizableLayout";
import type { MemoryGraph } from "@/lib/memoryGalaxy";
import { installErrorReporter } from "@/lib/errorReporter";
import { useAutofixLoop } from "@/lib/useAutofixLoop";
import { initNotifications } from "@/lib/notify";
import { uiEventBus } from "@/lib/uiEventBus";

export default function Page() {
  const [activeAgents, setActiveAgents] = useState<Array<{ id: string; prompt?: string }>>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [galaxy, setGalaxy] = useState<MemoryGraph | null>(null);
  const [sidebarTab, setSidebarTab] = useState<"listener" | "conductor">("conductor");
  const [galaxyOpen, setGalaxyOpen] = useState(false);
  const [galaxyWidth, setGalaxyWidth] = useState(320);

  useAutofixLoop();

  useEffect(() => {
    const galaxyOpenStored = localStorage.getItem("ultronos.galaxy.open");
    const galaxyWidthStored = localStorage.getItem("ultronos.galaxy.width");
    if (galaxyOpenStored === "true") setGalaxyOpen(true);
    if (galaxyWidthStored) setGalaxyWidth(parseInt(galaxyWidthStored, 10));
  }, []);

  useEffect(() => {
    installErrorReporter();
    initNotifications();
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/memory-galaxy")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok) setGalaxy(d.graph);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        uiEventBus.emitOpenPalette();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMemoryOpen((o) => !o);
        uiEventBus.emitOpenMemory();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGalaxyOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setSettingsOpen((o) => !o);
        uiEventBus.emitOpenSettings();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openAgent = (agentId: string, prompt?: string) => {
    setActiveAgents((prev) => {
      const existing = prev.find((a) => a.id === agentId);
      if (existing) return prev;
      return [...prev, { id: agentId, prompt }];
    });
  };

  const closeAgent = (agentId: string) => {
    setActiveAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  const handleGalaxyOpen = () => {
    setGalaxyOpen(true);
    localStorage.setItem("ultronos.galaxy.open", "true");
  };

  const handleGalaxyClose = () => {
    setGalaxyOpen(false);
    localStorage.setItem("ultronos.galaxy.open", "false");
  };

  const handleGalaxyResize = (newWidth: number) => {
    setGalaxyWidth(newWidth);
    localStorage.setItem("ultronos.galaxy.width", newWidth.toString());
  };

  return (
    <div className="starfield scanlines flex h-screen flex-col overflow-hidden bg-bg-base">
      <TitleBarHost
        onOpenPalette={() => setPaletteOpen(true)}
        onOpenMemory={() => setMemoryOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenGalaxy={() => handleGalaxyOpen()}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        <ResizableLayout
          galaxyOpen={galaxyOpen}
          left={<CapabilitiesPanel />}
          center={
            <div className="h-full overflow-auto px-6 py-5">
              <div className="mx-auto w-full max-w-6xl space-y-6">
                <AgentLauncher
                  activeIds={activeAgents.map((a) => a.id)}
                  onLaunch={(id) => openAgent(id)}
                />
                <RoomGrid
                  activeAgentIds={activeAgents.map((a) => a.id)}
                  onFocus={(id) => openAgent(id)}
                  onClose={(id) => closeAgent(id)}
                />
                <SuggestionsPanel onRun={(id, prompt) => openAgent(id, prompt)} />
              </div>
            </div>
          }
          galaxy={
            <div className="flex h-full flex-col gap-2 border-l border-white/10 bg-[#060318] p-3">
              <div className="flex items-center justify-between">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-white/40">
                  ★ Galaxy
                </div>
                <button
                  onClick={handleGalaxyClose}
                  className="text-white/40 transition hover:text-cyan-400"
                  title="Close (Ctrl+G)"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-[#05070d]">
                {galaxy ? (
                  <MemoryGalaxy graph={galaxy} />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-mono text-xs text-white/40">
                    initializing…
                  </div>
                )}
              </div>
            </div>
          }
          right={
            <div className="flex h-full flex-col gap-2 border-l border-white/10 bg-[#060318] p-3">
              <div className="flex gap-1">
                <button
                  onClick={() => setSidebarTab("listener")}
                  className={`flex-1 rounded-sm border px-2 py-1 text-[8px] uppercase tracking-widest transition ${
                    sidebarTab === "listener"
                      ? "border-emerald-400 text-emerald-300"
                      : "border-white/15 text-white/40 hover:text-white/70"
                  }`}
                >
                  Listener
                </button>
                <button
                  onClick={() => setSidebarTab("conductor")}
                  className={`flex-1 rounded-sm border px-2 py-1 text-[8px] uppercase tracking-widest transition ${
                    sidebarTab === "conductor"
                      ? "border-fuchsia-400 text-fuchsia-300"
                      : "border-white/15 text-white/40 hover:text-white/70"
                  }`}
                >
                  Conductor
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                {sidebarTab === "listener" ? <ListenerPanel /> : <ConductorPanel />}
              </div>
            </div>
          }
        />
      </main>

      {activeAgents.map((agent) => (
        <ChatModal
          key={agent.id}
          agentId={agent.id}
          initialPrompt={agent.prompt}
          onClose={() => closeAgent(agent.id)}
        />
      ))}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(id) => {
          setPaletteOpen(false);
          openAgent(id);
        }}
      />

      <MemoryPanel open={memoryOpen} onClose={() => setMemoryOpen(false)} />

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />

      <ToastHost />
    </div>
  );
}
