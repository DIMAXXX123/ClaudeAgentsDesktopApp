"use client";

import { useState, useMemo, Suspense } from "react";
import dynamic from "next/dynamic";
import { MemoryGalaxy } from "@/components/MemoryGalaxy";
import { MemoryGalaxyTimeline } from "@/components/galaxy/MemoryGalaxyTimeline";
import { PlanetDetail } from "@/components/galaxy/PlanetDetail";
import type { MemoryGraph, MemoryNode } from "@/lib/memoryGalaxy";

type Props = {
  graph: MemoryGraph;
};

const MemoryGalaxy3D = dynamic(() => import("./MemoryGalaxy3D").then((m) => ({ default: m.MemoryGalaxy3D })), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center text-white/50">Loading 3D…</div>,
});

type Tab = "2d" | "timeline" | "3d";

export function MemoryGalaxyTabs({ graph }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("2d");
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);

  const selectedNode = useMemo(() => {
    if (!selectedId) return null;
    return graph.nodes.find((n) => n.id === selectedId) || null;
  }, [selectedId, graph.nodes]);

  const tabClasses = "px-4 py-2 text-xs font-mono uppercase tracking-widest transition-colors";
  const baseClass = "border-b text-white/50 hover:text-white/70";
  const activeClass = "border-b border-white text-white";

  return (
    <div className="flex h-full w-full flex-col bg-black">
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("2d")}
          className={`${tabClasses} ${activeTab === "2d" ? activeClass : baseClass}`}
        >
          Graph 2D
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`${tabClasses} ${activeTab === "timeline" ? activeClass : baseClass}`}
        >
          Timeline
        </button>
        <button
          onClick={() => setActiveTab("3d")}
          className={`${tabClasses} ${activeTab === "3d" ? activeClass : baseClass}`}
        >
          Galaxy 3D
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden flex">
        <div className="flex-1">
          {activeTab === "2d" && <MemoryGalaxy graph={graph} />}

          {activeTab === "timeline" && <MemoryGalaxyTimeline graph={graph} />}

          {activeTab === "3d" && (
            <Suspense fallback={<div className="flex h-full w-full items-center justify-center text-white/50">Loading 3D…</div>}>
              <MemoryGalaxy3D
                nodes={graph.nodes}
                edges={graph.edges}
                selectedId={selectedId}
                onSelectNode={setSelectedId}
              />
            </Suspense>
          )}
        </div>

        {activeTab === "3d" && (
          <PlanetDetail
            node={selectedNode}
            onClose={() => setSelectedId(undefined)}
            onOpen2D={(id) => {
              setSelectedId(id);
              setActiveTab("2d");
            }}
          />
        )}
      </div>
    </div>
  );
}
