/**
 * Keyboard Macro Store for CommandPaletteV2.
 *
 * A macro is a named keyboard shortcut that triggers a palette action:
 *   - open-agent: open chat with a specific agentId
 *   - send-prompt: open agent + prefill a prompt
 *   - run-command: execute a named command (e.g. "open-memory", "open-galaxy")
 *
 * Macros are persisted in localStorage (client) and optionally synced to
 * /api/bridge/macros (server) for cross-device persistence.
 */

export type MacroAction =
  | { type: "open-agent"; agentId: string }
  | { type: "send-prompt"; agentId: string; prompt: string }
  | { type: "run-command"; command: string };

export interface Macro {
  id: string;
  name: string;
  /** e.g. "ctrl+1", "ctrl+shift+k", "alt+u" */
  keybinding: string;
  action: MacroAction;
  createdAt: number;
}

const STORAGE_KEY = "ultronos:macros:v1";

// ── Parse keybinding ─────────────────────────────────────────────────────────

export interface ParsedKey {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  key: string; // lowercase key name, e.g. "k", "1", "escape"
}

export function parseKeybinding(kb: string): ParsedKey {
  const parts = kb.toLowerCase().split("+");
  return {
    ctrl: parts.includes("ctrl"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd"),
    key: parts[parts.length - 1],
  };
}

export function matchesEvent(kb: ParsedKey, e: KeyboardEvent): boolean {
  return (
    e.ctrlKey === kb.ctrl &&
    e.altKey === kb.alt &&
    e.shiftKey === kb.shift &&
    e.metaKey === kb.meta &&
    e.key.toLowerCase() === kb.key
  );
}

/** Display-friendly keybinding label, e.g. "Ctrl+Shift+K" */
export function formatKeybinding(kb: string): string {
  return kb
    .split("+")
    .map((p) => {
      const map: Record<string, string> = {
        ctrl: "Ctrl",
        alt: "Alt",
        shift: "Shift",
        meta: "⌘",
        cmd: "⌘",
      };
      return map[p.toLowerCase()] ?? p.toUpperCase();
    })
    .join("+");
}

// ── Storage ──────────────────────────────────────────────────────────────────

function loadFromStorage(): Macro[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Macro[]) : defaultMacros();
  } catch {
    return defaultMacros();
  }
}

function saveToStorage(macros: Macro[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
}

function defaultMacros(): Macro[] {
  return [
    {
      id: "macro-ultron",
      name: "Open ULTRON",
      keybinding: "ctrl+1",
      action: { type: "open-agent", agentId: "ultron" },
      createdAt: Date.now(),
    },
    {
      id: "macro-nova",
      name: "Open NOVA",
      keybinding: "ctrl+2",
      action: { type: "open-agent", agentId: "nova" },
      createdAt: Date.now(),
    },
    {
      id: "macro-forge",
      name: "Open FORGE",
      keybinding: "ctrl+3",
      action: { type: "open-agent", agentId: "forge" },
      createdAt: Date.now(),
    },
    {
      id: "macro-memory",
      name: "Open Memory Panel",
      keybinding: "ctrl+m",
      action: { type: "run-command", command: "open-memory" },
      createdAt: Date.now(),
    },
  ];
}

// ── MacroStore class ─────────────────────────────────────────────────────────

export class MacroStore {
  private macros: Macro[];
  private listeners: Set<() => void> = new Set();

  constructor() {
    this.macros = loadFromStorage();
  }

  getAll(): Macro[] {
    return [...this.macros];
  }

  get(id: string): Macro | undefined {
    return this.macros.find((m) => m.id === id);
  }

  add(macro: Omit<Macro, "id" | "createdAt">): Macro {
    const m: Macro = {
      ...macro,
      id: `macro-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    this.macros = [...this.macros, m];
    this.persist();
    return m;
  }

  update(id: string, patch: Partial<Omit<Macro, "id" | "createdAt">>): void {
    this.macros = this.macros.map((m) => (m.id === id ? { ...m, ...patch } : m));
    this.persist();
  }

  remove(id: string): void {
    this.macros = this.macros.filter((m) => m.id !== id);
    this.persist();
  }

  /** Find macro matching a keyboard event. */
  findByEvent(e: KeyboardEvent): Macro | undefined {
    for (const macro of this.macros) {
      const parsed = parseKeybinding(macro.keybinding);
      if (matchesEvent(parsed, e)) return macro;
    }
    return undefined;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private persist() {
    saveToStorage(this.macros);
    this.notify();
    // Fire-and-forget server sync
    if (typeof fetch !== "undefined") {
      fetch("/api/bridge/macros", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.macros),
      }).catch(() => {/* offline is fine */});
    }
  }
}

// Singleton
export const macroStore = new MacroStore();
