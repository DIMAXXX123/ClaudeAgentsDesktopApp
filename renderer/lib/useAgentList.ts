import { useEffect, useRef, useState } from "react";
import type { AgentRuntime } from "@/types/ultronos";

/**
 * Hook to list all running agent runtimes.
 * Polls every 2 seconds until reactive mechanism available.
 */
export function useAgentList(): AgentRuntime[] {
  const [runtimes, setRuntimes] = useState<AgentRuntime[]>([]);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    const poll = async () => {
      if (!window.ultronos?.agent) return;
      try {
        const list = await window.ultronos.agent.list();
        setRuntimes(list);
      } catch (err) {
        console.error("[useAgentList] failed to list:", err);
      }
    };

    // Initial poll
    poll();

    // Poll every 2s
    pollRef.current = window.setInterval(poll, 2000);

    return () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
      }
    };
  }, []);

  return runtimes;
}
