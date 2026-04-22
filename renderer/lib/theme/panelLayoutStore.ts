/**
 * Panel Layout Persistence Engine
 *
 * Tracks per-panel position/size in localStorage.
 * Supports named workspace presets (save / load / delete).
 *
 * No external drag-and-drop deps — mouse events handled in PanelFrame.
 */

"use client";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PanelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspacePreset {
  id: string;
  name: string;
  createdAt: number;
  layout: Record<string, PanelRect>;
}

// ─── Storage keys ────────────────────────────────────────────────────────────

const LAYOUT_KEY = "ultronos:panel-layout";
const PRESETS_KEY = "ultronos:workspace-presets";

// ─── In-memory state ─────────────────────────────────────────────────────────

let _layout: Record<string, PanelRect> = {};
let _presets: WorkspacePreset[] = [];
const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((l) => l());
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

function _readLayout(): Record<string, PanelRect> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PanelRect>) : {};
  } catch {
    return {};
  }
}

function _writeLayout(layout: Record<string, PanelRect>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
}

function _readPresets(): WorkspacePreset[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    return raw ? (JSON.parse(raw) as WorkspacePreset[]) : [];
  } catch {
    return [];
  }
}

function _writePresets(presets: WorkspacePreset[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// ─── Default rect when a panel has no saved position ─────────────────────────

export function defaultRect(panelId: string, index = 0): PanelRect {
  // Cascade panels in a grid-like pattern so they don't all stack
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: 16 + col * 340,
    y: 64 + row * 260,
    w: 320,
    h: 240,
  };
}

// ─── Public store ─────────────────────────────────────────────────────────────

export const panelLayoutStore = {
  /** Initialise from localStorage — call once on client mount */
  hydrate() {
    _layout = _readLayout();
    _presets = _readPresets();
    _emit();
  },

  // ── Layout ──────────────────────────────────────────────────────────────────

  getRect(panelId: string, fallbackIndex = 0): PanelRect {
    return _layout[panelId] ?? defaultRect(panelId, fallbackIndex);
  },

  setRect(panelId: string, rect: PanelRect) {
    _layout = { ..._layout, [panelId]: rect };
    _writeLayout(_layout);
    _emit();
  },

  movePanel(panelId: string, dx: number, dy: number) {
    const current = panelLayoutStore.getRect(panelId);
    panelLayoutStore.setRect(panelId, {
      ...current,
      x: Math.max(0, current.x + dx),
      y: Math.max(0, current.y + dy),
    });
  },

  resizePanel(panelId: string, dw: number, dh: number, minW = 160, minH = 120) {
    const current = panelLayoutStore.getRect(panelId);
    panelLayoutStore.setRect(panelId, {
      ...current,
      w: Math.max(minW, current.w + dw),
      h: Math.max(minH, current.h + dh),
    });
  },

  resetPanel(panelId: string, fallbackIndex = 0) {
    const { [panelId]: _, ...rest } = _layout;
    _layout = rest;
    _writeLayout(_layout);
    _emit();
  },

  resetAll() {
    _layout = {};
    _writeLayout(_layout);
    _emit();
  },

  // ── Presets ─────────────────────────────────────────────────────────────────

  getPresets(): WorkspacePreset[] {
    return [..._presets];
  },

  savePreset(name: string): WorkspacePreset {
    const preset: WorkspacePreset = {
      id: `preset-${Date.now()}`,
      name: name.trim() || `Workspace ${_presets.length + 1}`,
      createdAt: Date.now(),
      layout: { ..._layout },
    };
    _presets = [..._presets, preset];
    _writePresets(_presets);
    _emit();
    return preset;
  },

  loadPreset(presetId: string): boolean {
    const preset = _presets.find((p) => p.id === presetId);
    if (!preset) return false;
    _layout = { ...preset.layout };
    _writeLayout(_layout);
    _emit();
    return true;
  },

  deletePreset(presetId: string): boolean {
    const before = _presets.length;
    _presets = _presets.filter((p) => p.id !== presetId);
    if (_presets.length === before) return false;
    _writePresets(_presets);
    _emit();
    return true;
  },

  renamePreset(presetId: string, newName: string): boolean {
    const idx = _presets.findIndex((p) => p.id === presetId);
    if (idx === -1) return false;
    _presets = _presets.map((p) =>
      p.id === presetId ? { ...p, name: newName.trim() || p.name } : p,
    );
    _writePresets(_presets);
    _emit();
    return true;
  },

  // ── Subscriptions ────────────────────────────────────────────────────────────

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

// ─── React hooks ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

export function usePanelRect(panelId: string, fallbackIndex = 0) {
  const [rect, setRect] = useState<PanelRect>(() =>
    panelLayoutStore.getRect(panelId, fallbackIndex),
  );

  useEffect(() => {
    panelLayoutStore.hydrate();
    setRect(panelLayoutStore.getRect(panelId, fallbackIndex));
    return panelLayoutStore.subscribe(() =>
      setRect(panelLayoutStore.getRect(panelId, fallbackIndex)),
    );
  }, [panelId, fallbackIndex]);

  const update = useCallback(
    (r: PanelRect) => panelLayoutStore.setRect(panelId, r),
    [panelId],
  );

  return { rect, update };
}

export function useWorkspacePresets() {
  const [presets, setPresets] = useState<WorkspacePreset[]>(() =>
    panelLayoutStore.getPresets(),
  );

  useEffect(() => {
    panelLayoutStore.hydrate();
    setPresets(panelLayoutStore.getPresets());
    return panelLayoutStore.subscribe(() =>
      setPresets(panelLayoutStore.getPresets()),
    );
  }, []);

  return {
    presets,
    savePreset: panelLayoutStore.savePreset.bind(panelLayoutStore),
    loadPreset: panelLayoutStore.loadPreset.bind(panelLayoutStore),
    deletePreset: panelLayoutStore.deletePreset.bind(panelLayoutStore),
    renamePreset: panelLayoutStore.renamePreset.bind(panelLayoutStore),
    resetAll: panelLayoutStore.resetAll.bind(panelLayoutStore),
  };
}

// ─── Drag / resize hook (mouse events, no deps) ──────────────────────────────

interface UseDragResizeOptions {
  panelId: string;
  minW?: number;
  minH?: number;
  /** Called when drag or resize begins (mousedown) */
  onInteractStart?: () => void;
  /** Called when drag or resize ends (mouseup); receives the panel element */
  onInteractEnd?: (el: HTMLElement | null) => void;
  /** Ref to the panel root element (used for settle animation) */
  panelRef?: RefObject<HTMLElement | null>;
}

export function useDragResize({
  panelId,
  minW = 160,
  minH = 120,
  onInteractStart,
  onInteractEnd,
  panelRef,
}: UseDragResizeOptions) {
  const dragOrigin = useRef<{ mx: number; my: number; x: number; y: number } | null>(null);
  const resizeOrigin = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  // ── Imperative helpers to eliminate React-state lag on first mousemove ────
  // React's setIsInteracting(true) is async — the re-render that sets
  // `transition: none` may arrive AFTER the first mousemove event, causing a
  // brief spring animation toward the cursor instead of instant grab.
  // Fix: directly mutate the panel element's style on mousedown so the
  // transition is disabled before any mousemove fires.

  function _lockTransition() {
    const el = panelRef?.current;
    if (!el) return;
    el.style.transition = "none";
    el.style.willChange = "left, top, width, height";
  }

  function _unlockTransition() {
    const el = panelRef?.current;
    if (!el) return;
    // Clear imperative overrides; React will apply the idle transition class
    // on next render (after onInteractEnd schedules a rAF).
    el.style.transition = "";
    el.style.willChange = "";
  }

  // ── Drag ───────────────────────────────────────────────────────────────────

  const onDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const rect = panelLayoutStore.getRect(panelId);
      dragOrigin.current = { mx: e.clientX, my: e.clientY, x: rect.x, y: rect.y };
      _lockTransition();   // ← imperative: disable CSS transitions NOW (no React lag)
      onInteractStart?.();

      const onMove = (ev: MouseEvent) => {
        if (!dragOrigin.current) return;
        const dx = ev.clientX - dragOrigin.current.mx;
        const dy = ev.clientY - dragOrigin.current.my;
        const current = panelLayoutStore.getRect(panelId);
        panelLayoutStore.setRect(panelId, {
          ...current,
          x: Math.max(0, dragOrigin.current.x + dx),
          y: Math.max(0, dragOrigin.current.y + dy),
        });
      };

      const onUp = () => {
        dragOrigin.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        _unlockTransition();  // ← restore CSS; React settle animation takes over
        onInteractEnd?.(panelRef?.current ?? null);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelId, onInteractStart, onInteractEnd, panelRef],
  );

  // ── Resize ─────────────────────────────────────────────────────────────────

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = panelLayoutStore.getRect(panelId);
      resizeOrigin.current = { mx: e.clientX, my: e.clientY, w: rect.w, h: rect.h };
      _lockTransition();   // ← same fix for resize
      onInteractStart?.();

      const onMove = (ev: MouseEvent) => {
        if (!resizeOrigin.current) return;
        const dw = ev.clientX - resizeOrigin.current.mx;
        const dh = ev.clientY - resizeOrigin.current.my;
        const current = panelLayoutStore.getRect(panelId);
        panelLayoutStore.setRect(panelId, {
          ...current,
          w: Math.max(minW, resizeOrigin.current.w + dw),
          h: Math.max(minH, resizeOrigin.current.h + dh),
        });
      };

      const onUp = () => {
        resizeOrigin.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        _unlockTransition();
        onInteractEnd?.(panelRef?.current ?? null);
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [panelId, minW, minH, onInteractStart, onInteractEnd, panelRef],
  );

  return { onDragMouseDown, onResizeMouseDown };
}
