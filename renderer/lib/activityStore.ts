"use client";

import { useEffect, useState } from "react";

type Activity = "idle" | "working" | "error";

const state = new Map<string, Activity>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export const activityStore = {
  set(agentId: string, value: Activity) {
    if (state.get(agentId) === value) return;
    if (value === "idle") state.delete(agentId);
    else state.set(agentId, value);
    emit();
  },
  get(agentId: string): Activity {
    return state.get(agentId) ?? "idle";
  },
  snapshot(): Record<string, Activity> {
    return Object.fromEntries(state);
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

export function useAgentActivity(agentId: string): Activity {
  const [, setTick] = useState(0);
  useEffect(() => {
    return activityStore.subscribe(() => setTick((t) => t + 1));
  }, []);
  return activityStore.get(agentId);
}

export function useAnyActivity(): Record<string, Activity> {
  const [snap, setSnap] = useState<Record<string, Activity>>(activityStore.snapshot());
  useEffect(() => {
    return activityStore.subscribe(() => setSnap(activityStore.snapshot()));
  }, []);
  return snap;
}
