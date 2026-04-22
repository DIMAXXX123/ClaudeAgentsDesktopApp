import type { ChatMsg } from "./useAgentChat";

const NS = "ultronos.chat.v1";
const SESS = "ultronos.session.v1";

export type StoredChat = {
  messages: ChatMsg[];
  sessionId?: string;
  updatedAt: number;
};

function safeLocal(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadChat(agentId: string): StoredChat {
  const ls = safeLocal();
  if (!ls) return empty();
  try {
    const raw = ls.getItem(`${NS}:${agentId}`);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as StoredChat;
    if (!Array.isArray(parsed.messages)) return empty();
    return {
      messages: parsed.messages.filter(isValidMsg),
      sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
    };
  } catch {
    return empty();
  }
}

export function saveChat(agentId: string, data: Omit<StoredChat, "updatedAt">) {
  const ls = safeLocal();
  if (!ls) return;
  try {
    const payload: StoredChat = { ...data, updatedAt: Date.now() };
    ls.setItem(`${NS}:${agentId}`, JSON.stringify(payload));
  } catch {
    // quota exceeded or similar — ignore
  }
}

export function clearChat(agentId: string) {
  const ls = safeLocal();
  if (!ls) return;
  ls.removeItem(`${NS}:${agentId}`);
  ls.removeItem(`${SESS}:${agentId}`);
}

export function listChatSummaries(agentIds: string[]) {
  return agentIds.map((id) => {
    const c = loadChat(id);
    return {
      agentId: id,
      count: c.messages.length,
      lastAt: c.messages.length ? c.updatedAt : 0,
      hasSession: !!c.sessionId,
    };
  });
}

function empty(): StoredChat {
  return { messages: [], sessionId: undefined, updatedAt: 0 };
}

function isValidMsg(m: unknown): m is ChatMsg {
  if (!m || typeof m !== "object") return false;
  const o = m as { role?: unknown; text?: unknown; tools?: unknown };
  if (o.role === "user") return typeof o.text === "string";
  if (o.role === "assistant") return typeof o.text === "string" && Array.isArray(o.tools);
  return false;
}
