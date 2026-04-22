"use client";

import { useEffect, useState } from "react";

export type TgFeedEntry = {
  t: number;
  dir: "in" | "out";
  user: number;
  name: string;
  text: string;
};

export function useTgFeed(pollMs = 3000, limit = 30) {
  const [entries, setEntries] = useState<TgFeedEntry[]>([]);

  useEffect(() => {
    // Try to use live feed via IPC if available
    const ultronos = (typeof window !== 'undefined' ? (window as any).ultronos : undefined) as
      | { feed: { on: (ch: string, cb: (data: unknown) => void) => () => void } }
      | undefined;

    if (ultronos?.feed) {
      const unsub = ultronos.feed.on('tg', (incoming: unknown) => {
        // When live feed sends new entries, append them
        const newEntries = incoming as TgFeedEntry[];
        if (Array.isArray(newEntries)) {
          setEntries((prev) => {
            const merged = [...prev, ...newEntries];
            // Keep only latest `limit` entries
            return merged.slice(-limit);
          });
        }
      });
      return unsub;
    }

    // Fallback to HTTP polling if not in Electron
    let aborted = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/tg-feed?limit=${limit}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { ok: boolean; entries: TgFeedEntry[] };
        if (!aborted && data.ok) setEntries(data.entries);
      } catch {
        // ignore transient failure
      }
    };
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      aborted = true;
      clearInterval(id);
    };
  }, [pollMs, limit]);

  return entries;
}
