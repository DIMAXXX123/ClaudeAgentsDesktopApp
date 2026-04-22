"use client";

import type { MemoryNode } from "@/lib/memoryGalaxy";
import { NODE_COLOR } from "@/lib/memoryGalaxy";

type Props = {
  node: MemoryNode | null;
  onClose: () => void;
  onOpen2D: (id: string) => void;
};

const TYPE_LABEL: Record<string, string> = {
  index: "Index",
  user: "User memory",
  feedback: "Feedback",
  project: "Project",
  reference: "Reference",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  rule: "Rule",
  hook: "Hook",
  plan: "Plan",
  "output-style": "Output style",
  "claude-md": "CLAUDE.md",
  "plugin-skill": "Plugin skill",
  "plugin-command": "Plugin cmd",
  "plugin-agent": "Plugin agent",
  unknown: "Other",
};

export function PlanetDetail({ node, onClose, onOpen2D }: Props) {
  if (!node) {
    return (
      <div className="w-80 border-l border-white/10 bg-black/50 p-4 text-xs text-white/50">
        <div>Select a node to view details</div>
      </div>
    );
  }

  const color = NODE_COLOR[node.type as keyof typeof NODE_COLOR];
  const typeLabel = TYPE_LABEL[node.type as keyof typeof TYPE_LABEL] || "Unknown";

  return (
    <div className="w-80 border-l border-white/10 bg-black/80 p-4 text-xs text-white font-mono">
      <button
        onClick={onClose}
        className="mb-4 text-white/40 hover:text-white/70 transition-colors"
      >
        ← Back
      </button>

      <div className="flex items-center gap-2 mb-4">
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <span className="text-white/70">{typeLabel}</span>
      </div>

      <h2 className="text-sm font-bold text-white mb-2 break-words">{node.name}</h2>

      {node.description && (
        <div className="mb-4 p-2 bg-white/5 rounded border border-white/10 text-white/60 text-xs leading-relaxed">
          {node.description}
        </div>
      )}

      <div className="space-y-3 text-white/50 text-xs">
        <div>
          <div className="text-white/40 mb-1">ID</div>
          <div className="text-white/60 break-words">{node.id}</div>
        </div>

        <div>
          <div className="text-white/40 mb-1">Degree</div>
          <div className="text-white/60">{node.degree} connections</div>
        </div>

        <div>
          <div className="text-white/40 mb-1">Size</div>
          <div className="text-white/60">{(node.sizeBytes / 1024).toFixed(1)} KB</div>
        </div>

        {node.tags.length > 0 && (
          <div>
            <div className="text-white/40 mb-1">Tags</div>
            <div className="flex flex-wrap gap-1">
              {node.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 rounded bg-white/10 text-white/70 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => onOpen2D(node.id)}
        className="mt-6 w-full px-3 py-2 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded border border-white/10 transition-colors text-xs font-mono"
      >
        Open in 2D Graph
      </button>
    </div>
  );
}
