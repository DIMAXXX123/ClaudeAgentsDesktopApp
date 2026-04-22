import { useEffect, useState } from "react";
import type { SwarmPlan } from "./swarm/types";

export function useSwarmPlan(planId: string | null) {
  const [plan, setPlan] = useState<SwarmPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;

    setLoading(true);
    setError(null);

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const fetchPlan = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/swarm/status/${planId}`);
        if (!res.ok) {
          throw new Error(`Status ${res.status}`);
        }
        const data: SwarmPlan = await res.json();
        if (cancelled) return;
        setPlan(data);

        if (data.status === "running") {
          timeoutId = setTimeout(fetchPlan, 500);
        } else {
          setLoading(false);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setLoading(false);
      }
    };

    fetchPlan();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [planId]);

  return { plan, loading, error };
}
