import { useCallback, useEffect, useRef, useState } from "react";
import type { TranscriptEvent } from "@/types/ultronos";

export type AgentOutputEvent =
  | { sessionId: string; agentId: string; kind: "assistant_text"; text: string }
  | { sessionId: string; agentId: string; kind: "tool_use"; name: string; input: unknown; id: string }
  | { sessionId: string; agentId: string; kind: "tool_result"; id: string; output: string; isError?: boolean }
  | { sessionId: string; agentId: string; kind: "status"; message: string }
  | { sessionId: string; agentId: string; kind: "error"; message: string }
  | { sessionId: string; agentId: string; kind: "done"; result?: string };

export interface UseAgent {
  transcript: TranscriptEvent[];
  liveEvents: AgentOutputEvent[];
  status: "spawning" | "running" | "idle" | "error" | "dead";
  send: (text: string) => Promise<void>;
  kill: () => Promise<void>;
  restart: () => Promise<void>;
  clear: () => Promise<void>;
}

export function useAgent(sessionId: string, agentId: string): UseAgent {
  const [transcript, setTranscript] = useState<TranscriptEvent[]>([]);
  const [liveEvents, setLiveEvents] = useState<AgentOutputEvent[]>([]);
  const [status, setStatus] = useState<UseAgent["status"]>("idle");
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;

  useEffect(() => {
    if (!window.ultronos?.agent) {
      console.error("[useAgent] window.ultronos.agent not available");
      return;
    }
    const { agent } = window.ultronos;

    agent.transcript(sessionId, 500).then(setTranscript);
    agent.list().then((runtimes) => {
      const rt = runtimes.find((r) => r.sessionId === sessionId);
      if (rt) setStatus(rt.status);
    });

    const unsubOutput = agent.onOutput((raw) => {
      const ev = raw as AgentOutputEvent;
      if (ev.sessionId !== sessionIdRef.current) return;
      setLiveEvents((prev) => [...prev, ev]);
      if (ev.kind === "done") setStatus("idle");
      if (ev.kind === "error") setStatus("error");
    });

    const unsubStatus = agent.onStatus((ev) => {
      if (ev.sessionId !== sessionIdRef.current) return;
      setStatus(ev.status);
    });

    return () => {
      unsubOutput();
      unsubStatus();
    };
  }, [sessionId, agentId]);

  const send = useCallback(async (text: string): Promise<void> => {
    if (!window.ultronos?.agent) throw new Error("Agent API not available");
    await window.ultronos.agent.input(sessionId, text);
  }, [sessionId]);

  const kill = useCallback(async (): Promise<void> => {
    if (!window.ultronos?.agent) throw new Error("Agent API not available");
    await window.ultronos.agent.kill(sessionId);
  }, [sessionId]);

  const restart = useCallback(async (): Promise<void> => {
    if (!window.ultronos?.agent) throw new Error("Agent API not available");
    await window.ultronos.agent.restart(agentId);
  }, [agentId]);

  const clear = useCallback(async (): Promise<void> => {
    if (!window.ultronos?.agent) throw new Error("Agent API not available");
    await window.ultronos.agent.clear(sessionId);
    setTranscript([]);
    setLiveEvents([]);
  }, [sessionId]);

  return { transcript, liveEvents, status, send, kill, restart, clear };
}
