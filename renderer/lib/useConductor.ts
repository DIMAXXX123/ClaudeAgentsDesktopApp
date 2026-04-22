"use client";
import { useEffect, useState } from "react";

export type ConductorStatus = {
  status: "ok" | "none";
  active?: boolean;
  aborted?: boolean;
  plan?: {
    createdAt: string;
    vision: string;
    slotCount: number;
    currentSlot: number;
    degraded: boolean;
    redStreak: number;
    slots: Array<{
      index: number;
      mode: "extend" | "polish" | "stabilization";
      status: "pending" | "running" | "completed" | "skipped" | "reverted";
      gate?: "green" | "red";
      titles: Record<string, string | null>;
    }>;
    revisionLog: Array<{ ts: string; slot: number; by: string; note: string }>;
    visionLog: Array<{ ts: string; note: string; by: string }>;
  };
  heartbeat?: { ts: number; slot: number; phase: string; pid: number } | null;
  lock?: { pid: number; startedAt: number; slot: number } | null;
  scoutPid?: number | null;
  scoutFeed?: Array<{
    ts: string;
    pillar: string;
    idea: string;
    sourceUrl?: string;
    rank: number;
    tags: string[];
  }>;
  journalTail?: string[];
  summary?: {
    slotCount: number;
    currentSlot: number;
    degraded: boolean;
    redStreak: number;
    scoutActive: boolean;
    greenSlots: number;
    redSlots: number;
    pendingSlots: number;
  };
};

export function useConductor(pollMs = 10_000) {
  const [data, setData] = useState<ConductorStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;

    const fetchStatus = async () => {
      try {
        const r = await fetch("/api/conductor/status", { cache: "no-store" });
        const json = (await r.json()) as ConductorStatus;
        if (!cancel) setData(json);
      } catch (e) {
        if (!cancel) setErr((e as Error).message);
      }
    };

    // Try to use live feed via IPC if available
    const ultronos = (typeof window !== 'undefined' ? (window as any).ultronos : undefined) as
      | { feed: { on: (ch: string, cb: (data: unknown) => void) => () => void } }
      | undefined;

    if (ultronos?.feed) {
      // Subscribe to plan changes
      const unsubPlan = ultronos.feed.on('conductor-plan', (incoming: unknown) => {
        if (!cancel) {
          setData((prev) => ({
            ...(prev || { status: 'ok' }),
            plan: incoming as ConductorStatus['plan'],
          }));
        }
      });

      // Subscribe to heartbeat changes
      const unsubHb = ultronos.feed.on('conductor-heartbeat', (incoming: unknown) => {
        if (!cancel) {
          setData((prev) => ({
            ...(prev || { status: 'ok' }),
            heartbeat: incoming as ConductorStatus['heartbeat'],
          }));
        }
      });

      void fetchStatus();
      const timer = setInterval(() => {
        void fetchStatus();
      }, pollMs);

      return () => {
        cancel = true;
        clearInterval(timer);
        unsubPlan();
        unsubHb();
      };
    }

    // Fallback to HTTP polling if not in Electron
    void fetchStatus();
    const timer = setInterval(() => {
      void fetchStatus();
    }, pollMs);

    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return { data, error: err };
}

export function useConductorJournal(pollMs = 20_000) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    let cancel = false;

    const fetchJ = async () => {
      try {
        const r = await fetch("/api/conductor/journal", { cache: "no-store" });
        const raw = await r.text();
        if (!cancel) setText(raw);
      } catch {
        // noop
      }
    };

    void fetchJ();
    const timer = setInterval(() => {
      void fetchJ();
    }, pollMs);

    return () => {
      cancel = true;
      clearInterval(timer);
    };
  }, [pollMs]);

  return text;
}
