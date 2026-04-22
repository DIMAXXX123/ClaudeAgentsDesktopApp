"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { sfx } from "@/lib/sfx";
import { saveCustomAgent } from "@/lib/rooms/customAgents";
import type { CustomAgent } from "@/lib/rooms/customAgents";

export function AddAgentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (agent: CustomAgent) => void;
}) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [color, setColor] = useState("#22e8ff");
  const [vibeInput, setVibeInput] = useState("");
  const [vibe, setVibe] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddVibe = () => {
    const trimmed = vibeInput.trim();
    if (trimmed && !vibe.includes(trimmed) && vibe.length < 5) {
      setVibe([...vibe, trimmed]);
      setVibeInput("");
    }
  };

  const handleRemoveVibe = (index: number) => {
    setVibe(vibe.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddVibe();
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !role.trim() || vibe.length === 0) {
      setError("All fields required (name, role, at least 1 vibe)");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/agents/generate-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          role: role.trim(),
          color,
          vibe,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Failed to generate room");
      }

      const data = (await response.json()) as {
        agentId: string;
        agent: CustomAgent;
      };
      saveCustomAgent(data.agent);
      sfx.select();
      onCreated?.(data.agent);
      onClose();
      // Reset form
      setName("");
      setRole("");
      setColor("#22e8ff");
      setVibe([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      sfx.error();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content className="fixed left-[50%] top-[50%] w-full max-w-md translate-x-[-50%] translate-y-[-50%] rounded-xl border border-white/10 bg-slate-950/80 backdrop-blur-md p-6 shadow-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-lg font-semibold uppercase tracking-wider text-neon-cyan pixel">
              [ADD AGENT]
            </Dialog.Title>
            <Dialog.Close className="text-white/40 hover:text-white/70 transition-colors">
              <X className="w-5 h-5" />
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-neon-cyan/70 mb-1 pixel">
                Agent Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CIPHER"
                disabled={loading}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30",
                  "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                  "text-sm font-mono",
                )}
              />
            </div>

            {/* Role */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-neon-cyan/70 mb-1 pixel">
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g., Cryptographer"
                disabled={loading}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30",
                  "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                  "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                  "text-sm font-mono",
                )}
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-neon-cyan/70 mb-1 pixel">
                Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={loading}
                  className="w-16 h-10 rounded-lg cursor-pointer border border-white/10 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  disabled={loading}
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    "text-sm font-mono",
                  )}
                />
              </div>
            </div>

            {/* Vibe Keywords */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-neon-cyan/70 mb-1 pixel">
                Vibe Keywords (1-5)
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={vibeInput}
                  onChange={(e) => setVibeInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading || vibe.length >= 5}
                  placeholder="e.g., wizard"
                  className={cn(
                    "flex-1 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30",
                    "focus:outline-none focus:border-neon-cyan/50 focus:ring-1 focus:ring-neon-cyan/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed transition-colors",
                    "text-sm font-mono",
                  )}
                />
                <button
                  onClick={handleAddVibe}
                  disabled={loading || !vibeInput.trim() || vibe.length >= 5}
                  className={cn(
                    "px-3 py-2 rounded-lg border border-white/10 text-xs uppercase tracking-wider font-mono",
                    "hover:border-neon-cyan/50 hover:text-neon-cyan transition-colors",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                  )}
                >
                  Add
                </button>
              </div>

              {/* Vibe chips */}
              <div className="flex flex-wrap gap-2">
                {vibe.map((v, i) => (
                  <div
                    key={i}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-neon-cyan/10 border border-neon-cyan/30 text-xs text-neon-cyan"
                  >
                    <span>{v}</span>
                    <button
                      onClick={() => handleRemoveVibe(i)}
                      disabled={loading}
                      className="ml-1 text-neon-cyan/50 hover:text-neon-cyan transition-colors"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="text-xs text-neon-red bg-neon-red/10 border border-neon-red/30 rounded-lg p-2 pixel">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={
                loading || !name.trim() || !role.trim() || vibe.length === 0
              }
              className={cn(
                "w-full px-4 py-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan uppercase tracking-wider text-xs font-mono pixel",
                "hover:border-neon-cyan/70 hover:bg-neon-cyan/20 hover:shadow-lg hover:shadow-neon-cyan/20 transition-all",
                "disabled:opacity-40 disabled:cursor-not-allowed",
                loading && "relative overflow-hidden",
              )}
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-3 h-3 border-2 border-neon-cyan/30 border-t-neon-cyan rounded-full animate-spin" />
                  GENERATING ROOM...
                </span>
              ) : (
                "CREATE AGENT"
              )}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
