"use client";

import { useEffect, useState } from "react";

type State = {
  lastRunAt: number | null;
  running: boolean;
  lastStatus: "idle" | "clean" | "ran" | "error";
  unfixed: number;
  bugsProcessed: number;
};

let state: State = {
  lastRunAt: null,
  running: false,
  lastStatus: "idle",
  unfixed: 0,
  bugsProcessed: 0,
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getAutofixState(): State {
  return state;
}

export function setAutofixState(partial: Partial<State>) {
  state = { ...state, ...partial };
  emit();
}

export function useAutofixState(): State {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return state;
}
