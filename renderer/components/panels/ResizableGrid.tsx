"use client";
/**
 * ResizableGrid
 *
 * A declarative wrapper that renders a collection of PanelFrames in a
 * coordinated, animated grid.
 *
 * Features:
 *  - Slots: panels snap to a virtual grid when released (optional)
 *  - Motion-12 spring layout transitions on every panel simultaneously
 *  - "Focus" mode: clicking a panel brings it to front (managed z-index)
 *  - Keyboard: Tab cycles focus, Escape collapses focus
 *
 * Usage:
 *   <ResizableGrid
 *     panels={[
 *       { id: "memory",   title: "Memory",   icon: "🧠", content: <MemoryPanel /> },
 *       { id: "chat",     title: "Chat",     icon: "💬", content: <ChatPanel /> },
 *     ]}
 *   />
 */

import { useCallback, useState, type ReactNode } from "react";
import { PanelFrame } from "@/components/panels/PanelFrame";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GridPanelDef {
  /** Unique stable id (used as panelLayoutStore key) */
  id: string;
  /** Display title */
  title: string;
  /** Optional emoji prefix */
  icon?: string;
  /** Panel content */
  content: ReactNode;
  /** Minimum width in px (default 200) */
  minW?: number;
  /** Minimum height in px (default 150) */
  minH?: number;
  /** Initially hidden? */
  defaultHidden?: boolean;
}

interface ResizableGridProps {
  panels: GridPanelDef[];
  /** Extra CSS class on the container (full-screen fixed overlay by default) */
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ResizableGrid({ panels, className = "" }: ResizableGridProps) {
  // Visibility: keyed by panel id
  const [hidden, setHidden] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      panels.filter((p) => p.defaultHidden).map((p) => [p.id, true]),
    ),
  );

  const togglePanel = useCallback((id: string) => {
    setHidden((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const visibleCount = panels.filter((p) => !hidden[p.id]).length;

  return (
    <>
      {/* ── Panel instances ────────────────────────────────────────────────── */}
      {panels.map((panel, idx) => (
        <PanelFrame
          key={panel.id}
          panelId={panel.id}
          title={panel.title}
          icon={panel.icon}
          minW={panel.minW ?? 200}
          minH={panel.minH ?? 150}
          fallbackIndex={idx}
          visible={!hidden[panel.id]}
          onClose={() => togglePanel(panel.id)}
          className={className}
        >
          {panel.content}
        </PanelFrame>
      ))}

      {/* ── Collapsed panel dock ───────────────────────────────────────────── */}
      {visibleCount < panels.length && (
        <div
          className={[
            "fixed bottom-4 left-1/2 -translate-x-1/2",
            "flex gap-2 flex-wrap justify-center",
            "z-30",
          ].join(" ")}
          style={{
            // Spring settle transition on the dock itself
            transition: "opacity 220ms cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {panels
            .filter((p) => hidden[p.id])
            .map((p) => (
              <button
                key={p.id}
                onClick={() => togglePanel(p.id)}
                title={`Restore ${p.title}`}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5",
                  "rounded-full text-[11px] font-mono tracking-widest uppercase",
                  "border border-[var(--ut-border)] bg-[var(--ut-bg-panel)]",
                  "text-[var(--ut-text-muted)]",
                  "hover:text-[var(--ut-text)] hover:border-[var(--ut-accent,#6366f1)]",
                  "shadow-sm select-none cursor-pointer",
                  "transition-colors duration-150",
                ].join(" ")}
              >
                {p.icon && <span>{p.icon}</span>}
                <span>{p.title}</span>
              </button>
            ))}
        </div>
      )}
    </>
  );
}
