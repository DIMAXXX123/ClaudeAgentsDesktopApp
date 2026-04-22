"use client";

import { useState } from "react";
import { SwarmInput } from "@/components/swarm/SwarmInput";
import { SwarmGantt } from "@/components/swarm/SwarmGantt";
import { SwarmTaskCard } from "@/components/swarm/SwarmTaskCard";
import { useSwarmPlan } from "@/lib/useSwarmPlan";
import type { SwarmPlan } from "@/lib/swarm/types";

export default function SwarmPage() {
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const { plan, loading } = useSwarmPlan(currentPlanId);

  const handlePlanCreated = (newPlan: SwarmPlan) => {
    setCurrentPlanId(newPlan.id);
  };

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-950 min-h-screen">
      <h1 className="text-3xl font-bold text-slate-100">Swarm Mode</h1>

      {/* Input section */}
      <SwarmInput onPlanCreated={handlePlanCreated} />

      {/* Status indicator */}
      {loading && (
        <div className="text-sm text-blue-400 animate-pulse">
          Polling swarm status...
        </div>
      )}

      {/* Gantt visualization */}
      {plan && <SwarmGantt plan={plan} />}

      {/* Tasks grid */}
      {plan && plan.tasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="col-span-full text-sm text-slate-400">
            {plan.tasks.length} задач • {plan.status}
          </div>
          {plan.tasks.map((task) => (
            <SwarmTaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
