"use client";

import { useState } from "react";
import type { SwarmPlan } from "@/lib/swarm/types";

interface SwarmInputProps {
  onPlanCreated: (plan: SwarmPlan) => void;
}

export function SwarmInput({ onPlanCreated }: SwarmInputProps) {
  const [goal, setGoal] = useState("");
  const [decomposing, setDecomposing] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<SwarmPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecompose = async () => {
    if (!goal.trim()) {
      setError("Введи цель");
      return;
    }

    setDecomposing(true);
    setError(null);

    try {
      const res = await fetch("/api/swarm/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const plan: SwarmPlan = await res.json();
      setCurrentPlan(plan);
      onPlanCreated(plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDecomposing(false);
    }
  };

  const handleExecute = async () => {
    if (!currentPlan) return;

    setExecuting(true);
    setError(null);

    try {
      const res = await fetch("/api/swarm/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: currentPlan.id }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      onPlanCreated(currentPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 border border-slate-700 rounded-lg bg-slate-900">
      <h2 className="text-lg font-bold text-slate-200">Swarm Mode</h2>

      <div className="flex flex-col gap-2">
        <label htmlFor="goal" className="text-sm text-slate-400">
          Цель
        </label>
        <textarea
          id="goal"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Опиши задачу, которую надо разложить на подзадачи..."
          className="w-full h-32 p-3 bg-slate-800 border border-slate-600 rounded text-slate-100 placeholder-slate-500 focus:outline-none focus:border-slate-400"
        />
      </div>

      {error && (
        <div className="text-sm text-rose-400 bg-rose-900 bg-opacity-30 p-2 rounded">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleDecompose}
          disabled={decomposing || !goal.trim()}
          className="flex-1 px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-100 rounded font-medium"
        >
          {decomposing ? "Раскладываю..." : "Decompose"}
        </button>

        {currentPlan && (
          <button
            onClick={handleExecute}
            disabled={executing || currentPlan.status === "running"}
            className="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-slate-100 rounded font-medium"
          >
            {executing ? "Запускаю..." : "Execute"}
          </button>
        )}
      </div>

      {currentPlan && (
        <div className="text-xs text-slate-400">
          Загруженный план: {currentPlan.id} ({currentPlan.tasks.length} задач)
        </div>
      )}
    </div>
  );
}
