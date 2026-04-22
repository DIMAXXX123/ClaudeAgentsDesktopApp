"use client";

import type { MemoryGraph } from "@/lib/memoryGalaxy";

type Props = {
  graph: MemoryGraph;
};

export function MemoryGalaxyTimeline({ graph }: Props) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
      <div className="text-white/50 font-mono text-xs">
        <div className="text-white/70 mb-2">Timeline View</div>
        <div>{graph.nodes.length} nodes across {graph.edges.length} connections</div>
        <div className="text-white/30 mt-4">Coming soon: chronological memory analysis</div>
      </div>
    </div>
  );
}
