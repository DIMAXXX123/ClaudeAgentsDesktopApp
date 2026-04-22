"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import type { RoomDef } from "./types";
import type { AgentSpec } from "../agents";

export type CustomAgent = AgentSpec & {
  custom: true;
  room: string;
  roomDef: RoomDef;
};

const STORAGE_KEY = "ultronos.customAgents.v1";

// Event emitter for reactivity
const listeners = new Set<() => void>();
const EMPTY_SNAPSHOT: CustomAgent[] = [];
let cachedSnapshot: CustomAgent[] = EMPTY_SNAPSHOT;
let cachedRaw: string | null = null;

function readSnapshot(): CustomAgent[] {
  if (typeof window === "undefined") return EMPTY_SNAPSHOT;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  if (!raw) {
    cachedSnapshot = EMPTY_SNAPSHOT;
    return cachedSnapshot;
  }
  try {
    cachedSnapshot = JSON.parse(raw) as CustomAgent[];
  } catch {
    cachedSnapshot = EMPTY_SNAPSHOT;
  }
  return cachedSnapshot;
}

function invalidateSnapshot(): void {
  cachedRaw = null;
}

function notifyListeners() {
  invalidateSnapshot();
  listeners.forEach((fn) => fn());
}

export function subscribeToCustomAgents(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

function getSnapshot(): CustomAgent[] {
  return readSnapshot();
}

function getServerSnapshot(): CustomAgent[] {
  return EMPTY_SNAPSHOT;
}

export function loadCustomAgents(): CustomAgent[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CustomAgent[];
  } catch {
    console.error("Failed to load custom agents from localStorage");
    return [];
  }
}

export function saveCustomAgent(agent: CustomAgent): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadCustomAgents();
    const index = current.findIndex((a) => a.id === agent.id);
    if (index >= 0) {
      current[index] = agent;
    } else {
      current.push(agent);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    notifyListeners();
  } catch (e) {
    console.error("Failed to save custom agent:", e);
  }
}

export function removeCustomAgent(id: string): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadCustomAgents();
    const filtered = current.filter((a) => a.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    notifyListeners();
  } catch (e) {
    console.error("Failed to remove custom agent:", e);
  }
}

export function useCustomAgents(): CustomAgent[] {
  return useSyncExternalStore(
    subscribeToCustomAgents,
    getSnapshot,
    getServerSnapshot,
  );
}
