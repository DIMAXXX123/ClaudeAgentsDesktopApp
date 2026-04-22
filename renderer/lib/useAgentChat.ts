"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfx } from "./sfx";
import { loadChat, saveChat, clearChat } from "./chatStore";
import { activityStore } from "./activityStore";
import { lastActivityStore } from "./lastActivityStore";
import { notify } from "./notify";
import { AGENTS } from "./agents";
import { profileStore } from "./profileStore";

export type ToolEvent = {
  id: string;
  name: string;
  input: unknown;
  output?: string;
  isError?: boolean;
};

export type ChatMsg =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; tools: ToolEvent[] };

export type AgentStatus = "idle" | "working" | "error";

export type SSEEvent =
  | { type: "assistant_text"; text: string }
  | { type: "tool_use"; name: string; input: unknown; id: string }
  | { type: "tool_result"; id: string; output: string; isError?: boolean }
  | { type: "done"; sessionId?: string; result?: string; error?: string }
  | { type: "error"; message: string };

export function reduceSSE(
  state: { messages: ChatMsg[]; status: AgentStatus; sessionId?: string },
  ev: SSEEvent,
): { messages: ChatMsg[]; status: AgentStatus; sessionId?: string } {
  const copy = [...state.messages];
  const last = copy[copy.length - 1];

  if (ev.type === "assistant_text") {
    if (last?.role === "assistant") {
      copy[copy.length - 1] = { ...last, text: last.text + ev.text };
    }
    return { ...state, messages: copy };
  }
  if (ev.type === "tool_use") {
    if (last?.role === "assistant") {
      copy[copy.length - 1] = {
        ...last,
        tools: [...last.tools, { id: ev.id, name: ev.name, input: ev.input }],
      };
    }
    return { ...state, messages: copy };
  }
  if (ev.type === "tool_result") {
    if (last?.role === "assistant") {
      copy[copy.length - 1] = {
        ...last,
        tools: last.tools.map((t) =>
          t.id === ev.id ? { ...t, output: ev.output, isError: ev.isError } : t,
        ),
      };
    }
    return { ...state, messages: copy };
  }
  if (ev.type === "done") {
    return {
      ...state,
      sessionId: ev.sessionId ?? state.sessionId,
      status: ev.error ? "error" : "idle",
    };
  }
  if (ev.type === "error") {
    if (last?.role === "assistant") {
      copy[copy.length - 1] = {
        ...last,
        text: (last.text ? last.text + "\n\n" : "") + "⚠️ " + ev.message,
      };
    }
    return { ...state, messages: copy, status: "error" };
  }
  return state;
}

export function useAgentChat(agentId: string) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [status, setStatus] = useState<AgentStatus>("idle");
  const sessionIdRef = useRef<string | undefined>(undefined);
  const abortRef = useRef<AbortController | null>(null);
  const loadedForRef = useRef<string | null>(null);
  // Set right after a hydrate; consumed by the very next save effect run so
  // we don't overwrite the just-loaded agent's storage with stale closure
  // messages from the previous render (the old agent's state).
  const justHydratedRef = useRef(false);

  useEffect(() => {
    const stored = loadChat(agentId);
    setMessages(stored.messages);
    sessionIdRef.current = stored.sessionId;
    setStatus("idle");
    justHydratedRef.current = true;
    loadedForRef.current = agentId;
  }, [agentId]);

  useEffect(() => {
    if (loadedForRef.current !== agentId) return;
    if (justHydratedRef.current) {
      justHydratedRef.current = false;
      return;
    }
    saveChat(agentId, { messages, sessionId: sessionIdRef.current });
  }, [agentId, messages]);

  const send = useCallback(
    async (prompt: string, attachedFiles?: Array<{ file: File; path?: string }>) => {
      if (!prompt.trim()) return;
      const agentName = AGENTS[agentId]?.name ?? agentId.toUpperCase();
      setMessages((m) => [
        ...m,
        { role: "user", text: prompt },
        { role: "assistant", text: "", tools: [] },
      ]);
      setStatus("working");
      activityStore.set(agentId, "working");
      sfx.send();
      notify(`→ ${agentName}`, prompt, "info");
      profileStore.recordSend(agentId, prompt);
      if (!sessionIdRef.current) profileStore.recordSessionStart(agentId);
      const startedAt = Date.now();

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        // Convert files to send format
        const files = attachedFiles
          ? await Promise.all(
              attachedFiles.map(async (af) => {
                if (af.path) {
                  return { name: af.file.name, path: af.path };
                } else {
                  const buf = await af.file.arrayBuffer();
                  const bytes = new Uint8Array(buf);
                  const base64 = btoa(String.fromCharCode.apply(null, Array.from(bytes)));
                  return { name: af.file.name, base64 };
                }
              })
            )
          : undefined;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId,
            prompt,
            sessionId: sessionIdRef.current,
            files,
          }),
          signal: ctrl.signal,
        });

        if (!res.body) throw new Error("no response body");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() ?? "";

          for (const chunk of chunks) {
            const line = chunk.trim();
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;

            let ev: SSEEvent;
            try {
              ev = JSON.parse(payload) as SSEEvent;
            } catch {
              continue;
            }

            if (ev.type === "tool_use") {
              sfx.tool();
              const target = previewToolInput(ev.name, ev.input);
              notify(`${agentName} ⚙ ${ev.name}`, target, "info");
              profileStore.recordToolUse(agentId, ev.name, ev.input);
              lastActivityStore.setTool(agentId, ev.name, target);
              if (ev.name === "Agent" && ev.input && typeof ev.input === "object") {
                const sub = (ev.input as Record<string, unknown>).subagent_type;
                if (typeof sub === "string" && AGENTS[sub]) {
                  lastActivityStore.setDelegation(sub, agentId);
                }
              }
            } else if (ev.type === "tool_result") {
              if (ev.isError) {
                notify(`${agentName} ❌ tool err`, ev.output?.slice(0, 200) ?? "", "error");
                profileStore.recordError(agentId);
              }
            } else if (ev.type === "done") {
              profileStore.recordDuration(agentId, Date.now() - startedAt);
              lastActivityStore.clearDelegation(agentId);
              if (ev.error) {
                sfx.error();
                notify(`${agentName} ✖ done (${ev.error})`, "", "error");
                profileStore.recordError(agentId);
              } else {
                sfx.receive();
                notify(`${agentName} ✓ done`, ev.result?.slice(0, 200) ?? "", "success");
              }
            } else if (ev.type === "error") {
              sfx.error();
              notify(`${agentName} ⚠ error`, ev.message, "error");
              profileStore.recordError(agentId);
            }

            setMessages((m) => {
              const next = reduceSSE(
                { messages: m, status: "working", sessionId: sessionIdRef.current },
                ev,
              );
              if (ev.type === "done") {
                sessionIdRef.current = next.sessionId;
                setStatus(next.status);
                activityStore.set(agentId, next.status);
              }
              if (ev.type === "error") {
                setStatus("error");
                activityStore.set(agentId, "error");
              }
              return next.messages;
            });
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          activityStore.set(agentId, "idle");
          notify(`${agentName} ⏹ stopped`, "", "warn");
          return;
        }
        sfx.error();
        setStatus("error");
        activityStore.set(agentId, "error");
        notify(`${agentName} ⚠ crash`, (err as Error).message, "error");
        setMessages((m) => {
          const copy = [...m];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = {
              ...last,
              text: (last.text ? last.text + "\n\n" : "") + "⚠️ " + (err as Error).message,
            };
          }
          return copy;
        });
      }
    },
    [agentId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
    activityStore.set(agentId, "idle");
  }, [agentId]);

  const reset = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = undefined;
    setStatus("idle");
    activityStore.set(agentId, "idle");
    clearChat(agentId);
  }, [agentId]);

  return { messages, status, send, stop, reset };
}

function previewToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  if (name === "Bash" && typeof obj.command === "string") return obj.command;
  if (name === "Read" && typeof obj.file_path === "string") return obj.file_path;
  if (name === "Edit" && typeof obj.file_path === "string") return obj.file_path;
  if (name === "Write" && typeof obj.file_path === "string") return obj.file_path;
  if (name === "Grep" && typeof obj.pattern === "string") return obj.pattern;
  if (name === "Glob" && typeof obj.pattern === "string") return obj.pattern;
  if (name === "WebFetch" && typeof obj.url === "string") return obj.url;
  if (name === "Agent" && typeof obj.subagent_type === "string")
    return `→ ${obj.subagent_type}`;
  try {
    return JSON.stringify(obj).slice(0, 120);
  } catch {
    return "";
  }
}
