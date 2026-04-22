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
    const parsed = JSON.parse(raw) as CustomAgent[];
    cachedSnapshot = parsed.filter(
      (agent) => agent && agent.id && agent.name && agent.color,
    );
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
    const parsed = JSON.parse(stored) as CustomAgent[];
    return parsed.filter(
      (agent) => agent && agent.id && agent.name && agent.color,
    );
  } catch {
    return [];
  }
}

export function saveCustomAgent(agent: CustomAgent): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!agent.id || !agent.name || !agent.color) {
      throw new Error(
        `Invalid agent: missing id=${!agent.id}, name=${!agent.name}, color=${!agent.color}`
      );
    }

    // Create a serializable version (exclude roomDef to avoid circular refs)
    const serializableAgent = {
      id: agent.id,
      name: agent.name,
      title: agent.title,
      room: agent.room,
      color: agent.color, // Explicitly preserve color
      emoji: agent.emoji,
      greeting: agent.greeting,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      allowedTools: agent.allowedTools,
      custom: agent.custom as true,
      // roomDef is NOT serialized - it will be reconstructed on load if needed
    } as CustomAgent;

    const current = loadCustomAgents();
    const index = current.findIndex((a) => a.id === agent.id);
    if (index >= 0) {
      current[index] = serializableAgent;
    } else {
      current.push(serializableAgent);
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
