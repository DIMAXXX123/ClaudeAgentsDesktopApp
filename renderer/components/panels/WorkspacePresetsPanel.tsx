"use client";

/**
 * WorkspacePresetsPanel
 *
 * UI panel for managing saved workspace layout presets:
 * - Save current layout under a custom name
 * - Load a preset (restores all panel positions & sizes)
 * - Delete a preset
 * - Reset all panels to default positions
 */

import { useState } from "react";
import { useWorkspacePresets } from "@/lib/theme/panelLayoutStore";

export function WorkspacePresetsPanel() {
  const { presets, savePreset, loadPreset, deletePreset, resetAll } = useWorkspacePresets();
  const [inputName, setInputName] = useState("");
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function handleSave() {
    const name = inputName.trim() || `Workspace ${presets.length + 1}`;
    savePreset(name);
    setInputName("");
  }

  function handleLoad(id: string) {
    loadPreset(id);
    setLoadedId(id);
    setTimeout(() => setLoadedId(null), 1500);
  }

  function handleDelete(id: string) {
    if (confirmDelete === id) {
      deletePreset(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
      setTimeout(() => setConfirmDelete(null), 3000);
    }
  }

  return (
    <div className="flex flex-col gap-3 select-none">
      {/* ── Save current layout ─────────────────────────────────────────────── */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={inputName}
          onChange={(e) => setInputName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          placeholder="Preset name…"
          className={[
            "flex-1 px-2 py-1 rounded text-[11px] font-mono",
            "bg-[var(--ut-bg-base)] border border-[var(--ut-border)]",
            "text-[var(--ut-text)] placeholder:text-[var(--ut-text-muted)]",
            "focus:outline-none focus:border-[var(--ut-accent)]",
          ].join(" ")}
        />
        <button
          onClick={handleSave}
          className={[
            "px-2.5 py-1 rounded text-[11px] font-mono uppercase tracking-widest",
            "bg-[var(--ut-accent)]/15 border border-[var(--ut-accent)]/50",
            "text-[var(--ut-accent)] hover:bg-[var(--ut-accent)]/25 transition-colors",
          ].join(" ")}
          title="Save current layout as preset"
        >
          Save
        </button>
      </div>

      {/* ── Preset list ──────────────────────────────────────────────────────── */}
      {presets.length === 0 ? (
        <p className="text-[10px] text-[var(--ut-text-muted)] text-center py-2 opacity-60">
          No saved presets
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {presets.map((preset) => {
            const isJustLoaded = loadedId === preset.id;
            const isConfirm = confirmDelete === preset.id;
            return (
              <li
                key={preset.id}
                className={[
                  "flex items-center gap-1.5 px-2 py-1.5 rounded",
                  "border transition-all duration-150",
                  isJustLoaded
                    ? "border-[var(--ut-accent)] bg-[var(--ut-accent)]/10"
                    : "border-[var(--ut-border)] bg-[var(--ut-bg-panel2)]",
                ].join(" ")}
              >
                {/* Preset name + date */}
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-mono text-[var(--ut-text)] truncate">
                    {preset.name}
                  </p>
                  <p className="text-[9px] text-[var(--ut-text-muted)] opacity-60">
                    {new Date(preset.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    {Object.keys(preset.layout).length} panels
                  </p>
                </div>

                {/* Load button */}
                <button
                  onClick={() => handleLoad(preset.id)}
                  className={[
                    "px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest",
                    "border transition-colors",
                    isJustLoaded
                      ? "border-[var(--ut-accent)] text-[var(--ut-accent)] bg-[var(--ut-accent)]/10"
                      : "border-[var(--ut-border)] text-[var(--ut-text-muted)] hover:border-[var(--ut-accent)] hover:text-[var(--ut-accent)]",
                  ].join(" ")}
                  title="Restore this layout"
                >
                  {isJustLoaded ? "✓" : "Load"}
                </button>

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(preset.id)}
                  className={[
                    "px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-widest",
                    "border transition-colors",
                    isConfirm
                      ? "border-red-500/70 text-red-400 bg-red-500/10"
                      : "border-transparent text-[var(--ut-text-muted)] opacity-40 hover:opacity-80 hover:border-red-500/50 hover:text-red-400",
                  ].join(" ")}
                  title={isConfirm ? "Click again to confirm delete" : "Delete preset"}
                >
                  {isConfirm ? "Sure?" : "✕"}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* ── Reset all ────────────────────────────────────────────────────────── */}
      {presets.length > 0 && (
        <div className="pt-1 border-t border-[var(--ut-border)]">
          <button
            onClick={resetAll}
            className="w-full text-[10px] font-mono uppercase tracking-widest text-[var(--ut-text-muted)] opacity-40 hover:opacity-70 transition-opacity py-1"
            title="Reset all panel positions to defaults"
          >
            ↺ Reset all positions
          </button>
        </div>
      )}
    </div>
  );
}
