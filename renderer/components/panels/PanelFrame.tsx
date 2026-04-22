"use client";

/**
 * PanelFrame
 *
 * A floating, draggable, resizable panel container.
 * - Drag by the title bar handle
 * - Resize by the bottom-right corner gripper
 * - Position & size persisted to localStorage via panelLayoutStore
 * - Motion-12-style spring layout animations on drag / resize
 *   (CSS spring transitions at idle, settle bounce on release)
 * - Renders children inside a scrollable body area
 */

import { useEffect, useRef, type ReactNode } from "react";
import {
  usePanelRect,
  useDragResize,
  panelLayoutStore,
} from "@/lib/theme/panelLayoutStore";
import { usePanelAnimation } from "@/lib/theme/usePanelAnimation";

interface PanelFrameProps {
  /** Unique stable ID used as the localStorage key */
  panelId: string;
  /** Display title shown in the drag bar */
  title: string;
  /** Optional emoji/icon prefix */
  icon?: string;
  /** Children rendered in the scrollable body */
  children: ReactNode;
  /** Minimum allowed width (px), default 160 */
  minW?: number;
  /** Minimum allowed height (px), default 120 */
  minH?: number;
  /** Index used to compute default stagger position */
  fallbackIndex?: number;
  /** Extra CSS class for the outer container */
  className?: string;
  /** Whether panel is visible at all (parent controls visibility) */
  visible?: boolean;
  /** Callback when the close button is clicked */
  onClose?: () => void;
}

export function PanelFrame({
  panelId,
  title,
  icon,
  children,
  minW = 160,
  minH = 120,
  fallbackIndex = 0,
  className = "",
  visible = true,
  onClose,
}: PanelFrameProps) {
  const { rect } = usePanelRect(panelId, fallbackIndex);
  const panelRef = useRef<HTMLDivElement>(null);
  // Pass panelRef so the animation hook can imperatively lock/unlock
  // CSS transitions on drag start/end (fixes the React-state-lag blocker).
  const anim = usePanelAnimation(panelRef);
  const { onDragMouseDown, onResizeMouseDown } = useDragResize({
    panelId,
    minW,
    minH,
    onInteractStart: anim.onInteractStart,
    onInteractEnd: anim.onInteractEnd,
    panelRef,
  });

  // Hydrate on first mount (safe to call multiple times — idempotent)
  useEffect(() => {
    panelLayoutStore.hydrate();
  }, []);

  // Apply the idle spring transition on mount (imperative; not part of
  // animationStyle so React can't override it mid-drag).
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const SPRING = "cubic-bezier(0.34, 1.56, 0.64, 1)";
    const FAST = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    el.style.transition = [
      `left 220ms ${SPRING}`,
      `top 220ms ${SPRING}`,
      `width 200ms ${FAST}`,
      `height 200ms ${FAST}`,
      "box-shadow 160ms ease",
      "opacity 120ms ease",
    ].join(", ");
    el.style.willChange = "auto";
  }, []);

  if (!visible) return null;

  return (
    <div
      ref={panelRef}
      className={[
        "fixed flex flex-col",
        "rounded-lg border border-[var(--ut-border)] bg-[var(--ut-bg-panel)]",
        // base shadow via CSS var (animation hook may override during interact)
        "shadow-[var(--ut-shadow)]",
        "overflow-hidden",
        className,
      ].join(" ")}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        minWidth: minW,
        minHeight: minH,
        // Shadow + z-index from anim (transition/willChange are imperative only)
        ...anim.animationStyle,
        // Lift above siblings while interacting
        zIndex: anim.isInteracting ? 50 : 40,
      }}
    >
      {/* ── Title / drag bar ────────────────────────────────────────────────── */}
      <div
        onMouseDown={onDragMouseDown}
        className={[
          "flex items-center gap-2 px-3 py-2 shrink-0",
          "border-b border-[var(--ut-border)] bg-[var(--ut-bg-panel2)]",
          "select-none cursor-grab active:cursor-grabbing",
        ].join(" ")}
      >
        {icon && <span className="text-sm">{icon}</span>}
        <span className="flex-1 text-[11px] font-mono uppercase tracking-widest text-[var(--ut-text-muted)] truncate">
          {title}
        </span>

        {/* Reset position button */}
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => panelLayoutStore.resetPanel(panelId, fallbackIndex)}
          className="opacity-30 hover:opacity-70 text-[var(--ut-text-muted)] text-[10px] leading-none transition-opacity px-1"
          title="Reset position"
        >
          ↺
        </button>

        {/* Close button */}
        {onClose && (
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            className="opacity-30 hover:opacity-80 text-[var(--ut-text-muted)] text-[11px] leading-none transition-opacity px-1"
            title="Close panel"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Panel body ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-3 min-h-0">{children}</div>

      {/* ── Resize gripper (bottom-right corner) ────────────────────────────── */}
      <div
        onMouseDown={onResizeMouseDown}
        className={[
          "absolute bottom-0 right-0 w-5 h-5",
          "cursor-se-resize select-none",
          "flex items-end justify-end pb-[3px] pr-[3px]",
        ].join(" ")}
        title="Resize panel"
      >
        {/* Visual grip dots */}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          className="opacity-25 text-[var(--ut-text-muted)] fill-current"
        >
          <circle cx="8" cy="8" r="1.2" />
          <circle cx="4.5" cy="8" r="1.2" />
          <circle cx="8" cy="4.5" r="1.2" />
        </svg>
      </div>
    </div>
  );
}
