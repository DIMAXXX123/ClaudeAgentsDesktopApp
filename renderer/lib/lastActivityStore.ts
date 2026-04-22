"use client";

import { useEffect, useState } from "react";

export type LastActivity = {
  tool: string;
  target: string;
  at: number;
  delegatedFrom?: string;
};

const state = new Map<string, LastActivity>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const lastActivityStore = {
  setTool(agentId: string, tool: string, target: string) {
    state.set(agentId, { tool, target, at: Date.now() });
    emit();
  },
  setDelegation(agentId: string, from: string) {
    const existing = state.get(agentId);
    state.set(agentId, {
      tool: existing?.tool ?? "Agent",
      target: existing?.target ?? from,
      at: Date.now(),
      delegatedFrom: from,
    });
    emit();
  },
  clearDelegation(agentId: string) {
    const existing = state.get(agentId);
    if (!existing?.delegatedFrom) return;
    const { delegatedFrom: _, ...rest } = existing;
    void _;
    state.set(agentId, rest);
    emit();
  },
  get(agentId: string): LastActivity | undefined {
    return state.get(agentId);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useLastActivity(agentId: string): LastActivity | undefined {
  const [, setTick] = useState(0);
  useEffect(() => {
    return lastActivityStore.subscribe(() => setTick((t) => t + 1));
  }, []);
  return lastActivityStore.get(agentId);
}
