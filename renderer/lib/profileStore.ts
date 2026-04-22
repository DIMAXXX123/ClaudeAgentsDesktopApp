"use client";

import { useEffect, useState } from "react";

const KEY = "ultronos.profile.v1";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "of", "on",
  "in", "to", "at", "by", "with", "from", "is", "are", "was", "were", "be", "been",
  "being", "do", "does", "did", "have", "has", "had", "can", "could", "should",
  "would", "will", "may", "might", "must", "i", "you", "he", "she", "it", "we",
  "they", "me", "my", "mine", "your", "yours", "his", "her", "hers", "our", "ours",
  "their", "theirs", "this", "that", "these", "those", "what", "which", "who",
  "whom", "whose", "when", "where", "why", "how", "as", "so", "about", "not",
  "no", "yes", "please", "also", "very", "just", "some", "any", "all", "one",
  "two", "three", "more", "less", "most", "least", "same", "own", "into", "out",
  "up", "down", "over", "under", "again", "new", "old",
  "и", "или", "но", "если", "то", "же", "бы", "ли", "не", "ни", "да", "нет",
  "я", "ты", "он", "она", "оно", "мы", "вы", "они", "меня", "тебя", "его", "её",
  "нас", "вас", "их", "мне", "тебе", "ему", "ей", "нам", "вам", "им", "мной",
  "тобой", "им", "ею", "нами", "вами", "ими", "мой", "твой", "свой", "ваш", "наш",
  "это", "тот", "та", "те", "эти", "что", "как", "где", "когда", "почему", "зачем",
  "для", "на", "в", "во", "с", "со", "из", "по", "от", "до", "за", "под", "над",
  "при", "про", "без", "сквозь", "вокруг", "через", "тут", "там", "здесь", "туда",
  "сюда", "оттуда", "сейчас", "потом", "уже", "еще", "ещё", "просто", "очень",
]);

function isStop(w: string) {
  return STOP_WORDS.has(w) || w.length < 3;
}

export type AgentProfile = {
  agentId: string;
  messagesSent: number;
  toolsUsed: number;
  sessionCount: number;
  errorsCount: number;
  totalDurationMs: number;
  firstSeenAt: number | null;
  lastSeenAt: number | null;
  toolCounts: Record<string, number>;
  keywords: Record<string, number>;
  delegationsOut: Record<string, number>; // me → other agent
  daily: Record<string, number>; // YYYY-MM-DD → count of interactions
};

export type ProfileDB = {
  agents: Record<string, AgentProfile>;
  lastUpdatedAt: number;
};

function empty(agentId: string): AgentProfile {
  return {
    agentId,
    messagesSent: 0,
    toolsUsed: 0,
    sessionCount: 0,
    errorsCount: 0,
    totalDurationMs: 0,
    firstSeenAt: null,
    lastSeenAt: null,
    toolCounts: {},
    keywords: {},
    delegationsOut: {},
    daily: {},
  };
}

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function load(): ProfileDB {
  const ls = safeLocal();
  if (!ls) return { agents: {}, lastUpdatedAt: 0 };
  try {
    const raw = ls.getItem(KEY);
    if (!raw) return { agents: {}, lastUpdatedAt: 0 };
    const parsed = JSON.parse(raw) as ProfileDB;
    if (!parsed || typeof parsed !== "object" || !parsed.agents) {
      return { agents: {}, lastUpdatedAt: 0 };
    }
    return parsed;
  } catch {
    return { agents: {}, lastUpdatedAt: 0 };
  }
}

function persist(db: ProfileDB) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    ls.setItem(KEY, JSON.stringify({ ...db, lastUpdatedAt: Date.now() }));
  } catch {
    // ignore quota
  }
}

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function getAgent(db: ProfileDB, id: string): AgentProfile {
  if (!db.agents[id]) db.agents[id] = empty(id);
  return db.agents[id];
}

function todayKey(ts = Date.now()) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const profileStore = {
  get(): ProfileDB {
    return load();
  },
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
  recordSend(agentId: string, prompt: string) {
    const db = load();
    const a = getAgent(db, agentId);
    const now = Date.now();
    a.messagesSent += 1;
    a.lastSeenAt = now;
    if (!a.firstSeenAt) a.firstSeenAt = now;
    const key = todayKey(now);
    a.daily[key] = (a.daily[key] ?? 0) + 1;
    const words = prompt
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !isStop(w));
    for (const w of words.slice(0, 30)) {
      a.keywords[w] = (a.keywords[w] ?? 0) + 1;
    }
    persist(db);
    emit();
  },
  recordToolUse(agentId: string, toolName: string, input: unknown) {
    const db = load();
    const a = getAgent(db, agentId);
    a.toolsUsed += 1;
    a.toolCounts[toolName] = (a.toolCounts[toolName] ?? 0) + 1;
    a.lastSeenAt = Date.now();
    // Track agent-to-agent delegation explicitly
    if (toolName === "Agent" && input && typeof input === "object") {
      const sub = (input as Record<string, unknown>).subagent_type;
      if (typeof sub === "string") {
        a.delegationsOut[sub] = (a.delegationsOut[sub] ?? 0) + 1;
      }
    }
    persist(db);
    emit();
  },
  recordSessionStart(agentId: string) {
    const db = load();
    const a = getAgent(db, agentId);
    a.sessionCount += 1;
    persist(db);
    emit();
  },
  recordError(agentId: string) {
    const db = load();
    const a = getAgent(db, agentId);
    a.errorsCount += 1;
    persist(db);
    emit();
  },
  recordDuration(agentId: string, ms: number) {
    if (ms <= 0) return;
    const db = load();
    const a = getAgent(db, agentId);
    a.totalDurationMs += ms;
    persist(db);
    emit();
  },
  forget(agentId: string) {
    const db = load();
    delete db.agents[agentId];
    persist(db);
    emit();
  },
  forgetAll() {
    const ls = safeLocal();
    if (ls) ls.removeItem(KEY);
    emit();
  },
};

export function useProfileDB(): ProfileDB {
  const [db, setDb] = useState<ProfileDB>(() =>
    typeof window === "undefined" ? { agents: {}, lastUpdatedAt: 0 } : load(),
  );
  useEffect(() => {
    const unsub = profileStore.subscribe(() => setDb(load()));
    return () => {
      unsub();
    };
  }, []);
  return db;
}

export function useAgentProfile(agentId: string): AgentProfile {
  const db = useProfileDB();
  return db.agents[agentId] ?? empty(agentId);
}
