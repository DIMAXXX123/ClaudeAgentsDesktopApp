"use client";

import { useEffect, useState } from "react";

export type ListenerSession = { user: string; sessionId: string };
export type ListenerProc = { pid: number; startedAt: string | null };

export type ListenerHealth = {
  alive: boolean;
  simpleBot: boolean;
  proc: ListenerProc | null;
  cwd: string;
  botUsername: string;
  allowedUsers: number[];
  sessions: ListenerSession[];
  lastLogLine: string | null;
  checkedAt: number;
  error?: string;
};

const INITIAL: ListenerHealth = {
  alive: false,
  simpleBot: false,
  proc: null,
  cwd: "",
  botUsername: "@OpenClawDimaxbot",
  allowedUsers: [],
  sessions: [],
  lastLogLine: null,
  checkedAt: 0,
};

export function useListenerHealth(pollMs = 5000): ListenerHealth {
  const [health, setHealth] = useState<ListenerHealth>(INITIAL);

  useEffect(() => {
    // Try to use live feed via IPC if available
    const ultronos = (typeof window !== 'undefined' ? (window as any).ultronos : undefined) as
      | { feed: { on: (ch: string, cb: (data: unknown) => void) => () => void } }
      | undefined;

    if (ultronos?.feed) {
      const unsub = ultronos.feed.on('listener-sessions', (incoming: unknown) => {
        // When sessions change, re-fetch full health state from API
        // (sessions alone don't represent full health, so we still need polling)
        // For now, just update the sessions part
        setHealth((prev) => ({
          ...prev,
          sessions: (incoming as ListenerSession[]) || [],
        }));
      });

      // Still do periodic polling for full health state (not just sessions)
      let aborted = false;
      const tick = async () => {
        try {
          const res = await fetch("/api/listener-health", { cache: "no-store" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = (await res.json()) as ListenerHealth;
          if (!aborted) setHealth(data);
        } catch (err) {
          if (!aborted) {
            setHealth({
              ...INITIAL,
              checkedAt: Date.now(),
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      };
      tick();
      const id = setInterval(tick, pollMs);

      return () => {
        aborted = true;
        clearInterval(id);
        unsub();
      };
    }

    // Fallback to HTTP polling if not in Electron
    let aborted = false;
    const tick = async () => {
      try {
        const res = await fetch("/api/listener-health", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ListenerHealth;
        if (!aborted) setHealth(data);
      } catch (err) {
        if (!aborted) {
          setHealth({
            ...INITIAL,
            checkedAt: Date.now(),
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, [pollMs]);

  return health;
}
