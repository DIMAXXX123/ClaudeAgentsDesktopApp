"use client";
/**
 * usePanelAnimation — Motion-12-style layout animations for PanelFrame
 *
 * No external dependencies. Achieves:
 *  - Spring-eased CSS transitions on left/top/width/height (idle only)
 *  - Lifted shadow + accent ring while user is dragging or resizing
 *  - "Settle" micro-bounce via Web Animations API when interaction ends
 *  - GPU will-change hints only while interacting (avoids stale compositing)
 *
 * Drag-resize animation blocker fix (slot-3):
 *  The original implementation used React state (setIsInteracting) to flip
 *  `transition: none` during drag. React state updates are async — the first
 *  mousemove event fires BEFORE the re-render, so CSS transitions are briefly
 *  active and the panel "springs" toward the cursor instead of instantly
 *  grabbing it.
 *
 *  Fix: `onInteractStart` / `onInteractEnd` now imperatively mutate
 *  `el.style.transition` and `el.style.willChange` via a stored panel ref.
 *  This happens synchronously on mousedown, bypassing React's render cycle.
 *  React state is still updated (for shadow + z-index), but the transition
 *  gate is controlled imperatively, not by re-render timing.
 *
 * Usage:
 *   const anim = usePanelAnimation(panelRef);
 *   // call anim.onInteractStart() on mousedown
 *   // call anim.onInteractEnd(panelEl) on mouseup
 *   // spread anim.animationStyle onto the panel root <div>
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, RefObject } from "react";

// ─── Easing constants (mirror Motion 12 spring defaults) ─────────────────────

/** spring(mass=1, stiffness=200, damping=20) approximation */
const SPRING_EASE = "cubic-bezier(0.34, 1.56, 0.64, 1)";
/** crisp ease for width/height (overshoot on size feels wrong) */
const FAST_EASE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";

// ─── Transition strings ───────────────────────────────────────────────────────

const TRANSITION_IDLE = [
  `left 220ms ${SPRING_EASE}`,
  `top 220ms ${SPRING_EASE}`,
  `width 200ms ${FAST_EASE}`,
  `height 200ms ${FAST_EASE}`,
  "box-shadow 160ms ease",
  "opacity 120ms ease",
].join(", ");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PanelAnimationState {
  /** True while user is actively dragging or resizing */
  isInteracting: boolean;
  /**
   * Inline style bag — spread onto the panel root element.
   * NOTE: `transition` and `willChange` are intentionally omitted here;
   * they are managed imperatively via direct DOM mutation (see onInteractStart)
   * to avoid React render-cycle lag. Only shadow + zIndex live here.
   */
  animationStyle: CSSProperties;
  /** Call from onMouseDown of the drag / resize handle */
  onInteractStart: () => void;
  /** Call from the global mouseup handler; pass the panel DOM ref */
  onInteractEnd: (el: HTMLElement | null) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param panelRef - ref to the panel root DOM element; required for the
 *   imperative transition lock that fixes the drag-start animation blocker.
 */
export function usePanelAnimation(
  panelRef?: RefObject<HTMLElement | null>,
): PanelAnimationState {
  const [isInteracting, setIsInteracting] = useState(false);
  const rafRef = useRef<number | null>(null);

  /** Cancel any in-flight animation frame on unmount */
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  /**
   * Imperatively lock the panel's CSS transition to prevent any spring
   * animation during drag/resize. Called synchronously on mousedown so
   * the first mousemove sees `transition: none` regardless of React state.
   */
  const _imperativeLock = useCallback(() => {
    const el = panelRef?.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.willChange = "left, top, width, height";
  }, [panelRef]);

  /**
   * Imperatively restore the idle spring transition.
   * Called after the settle RAF so the browser paints the final position
   * before transitions are re-enabled (prevents snap-back artifact).
   */
  const _imperativeUnlock = useCallback(() => {
    const el = panelRef?.current;
    if (!el) return;
    el.style.transition = TRANSITION_IDLE;
    el.style.willChange = "auto";
  }, [panelRef]);

  const onInteractStart = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    // Imperative lock fires synchronously — guarantees no CSS transition
    // during drag even if React hasn't re-rendered yet.
    _imperativeLock();
    setIsInteracting(true);
  }, [_imperativeLock]);

  const onInteractEnd = useCallback(
    (el: HTMLElement | null) => {
      // Re-enable transitions in the next frame so the browser has the new
      // position painted before we switch CSS transitions back on.
      rafRef.current = requestAnimationFrame(() => {
        setIsInteracting(false);
        rafRef.current = null;
        // Restore idle spring transition after state flips
        _imperativeUnlock();

        // "Settle" micro-bounce — only if the element is still mounted and
        // Web Animations API is available (guard for SSR / happy-dom tests).
        if (el && typeof el.animate === "function") {
          el.animate(
            [
              {
                transform: "scale(1.014)",
                boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
              },
              {
                transform: "scale(1)",
                boxShadow: "var(--ut-shadow, 0 4px 16px rgba(0,0,0,0.25))",
              },
            ],
            {
              duration: 380,
              easing: SPRING_EASE,
              fill: "none",
            },
          );
        }
      });
    },
    [_imperativeUnlock],
  );

  // transition/willChange are managed imperatively above — omit from here
  // to prevent React from overriding the imperative values mid-drag.
  const animationStyle: CSSProperties = isInteracting
    ? {
        // Visual "lifted" state (shadow + z-index only; no transition here)
        boxShadow:
          "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1.5px var(--ut-accent, #6366f1)",
        zIndex: 50,
      }
    : {
        // No transition/willChange override — imperative styles are live
        zIndex: undefined,
      };

  return {
    isInteracting,
    animationStyle,
    onInteractStart,
    onInteractEnd,
  };
}
