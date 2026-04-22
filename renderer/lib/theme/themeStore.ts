"use client";

import { useEffect, useState } from "react";
import {
  type ThemeId,
  THEMES,
  DEFAULT_THEME,
  buildThemeCss,
} from "./themes";

const STORAGE_KEY = "ultronos:theme";

// ─── In-memory state ──────────────────────────────────────────────────────────

let _current: ThemeId = DEFAULT_THEME;
const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((l) => l());
}

function _readStorage(): ThemeId {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const v = localStorage.getItem(STORAGE_KEY) as ThemeId | null;
  return v && v in THEMES ? v : DEFAULT_THEME;
}

function _writeStorage(id: ThemeId) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, id);
}

// ─── DOM side-effect: apply CSS vars + html class ─────────────────────────────

function _applyToDom(id: ThemeId) {
  if (typeof document === "undefined") return;

  const theme = THEMES[id];

  // Remove old theme classes
  const html = document.documentElement;
  Object.values(THEMES).forEach((t) => html.classList.remove(t.htmlClass));
  html.classList.add(theme.htmlClass);

  // Inject or update <style id="ut-theme-vars">
  const css = `:root { ${buildThemeCss(theme.tokens)} }`;
  let tag = document.getElementById("ut-theme-vars") as HTMLStyleElement | null;
  if (!tag) {
    tag = document.createElement("style");
    tag.id = "ut-theme-vars";
    document.head.appendChild(tag);
  }
  tag.textContent = css;
}

// ─── Public store ─────────────────────────────────────────────────────────────

export const themeStore = {
  /** Current theme id (may be stale before hydration) */
  get current(): ThemeId {
    return _current;
  },

  /** Initialise from localStorage — call once on client mount */
  hydrate() {
    _current = _readStorage();
    _applyToDom(_current);
    _emit();
  },

  set(id: ThemeId) {
    if (id === _current) return;
    _current = id;
    _writeStorage(id);
    _applyToDom(id);
    _emit();
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};

// ─── React hook ───────────────────────────────────────────────────────────────

export function useTheme(): { theme: ThemeId; setTheme: (id: ThemeId) => void } {
  const [theme, setLocal] = useState<ThemeId>(_current);

  useEffect(() => {
    // Hydrate on first mount
    themeStore.hydrate();
    setLocal(themeStore.current);

    // Subscribe to future changes
    return themeStore.subscribe(() => setLocal(themeStore.current));
  }, []);

  return { theme, setTheme: themeStore.set.bind(themeStore) };
}
