"use client";

import { useMemo } from "react";
import type { SwarmPlan, SwarmTask } from "@/lib/swarm/types";

interface SwarmGanttProps {
  plan: SwarmPlan | null;
}

export function SwarmGantt({ plan }: SwarmGanttProps) {
  if (!plan || plan.tasks.length === 0) {
    return (
      <div className="p-4 text-slate-400 text-sm">
        Нет плана для визуализации
      </div>
    );
  }

  const { agentRows, timelineStart, timelineEnd, tasks } = useMemo(() => {
    const agents = Array.from(new Set(plan.tasks.map((t) => t.agentId))).sort();
    const rows = new Map(agents.map((a, i) => [a, i]));

    // Find time bounds
    const started = plan.tasks.filter((t) => t.startedAt).map((t) => t.startedAt!);
    const finished = plan.tasks.filter((t) => t.finishedAt).map((t) => t.finishedAt!);
    const allTimes = [...started, ...finished, plan.createdAt];

    const minTime = allTimes.length > 0 ? Math.min(...allTimes) : Date.now();
    const maxTime = allTimes.length > 0 ? Math.max(...allTimes) : Date.now();
    const duration = Math.max(maxTime - minTime, 1000); // At least 1 second

    return {
      agentRows: rows,
      timelineStart: minTime,
      timelineEnd: maxTime,
      tasks: plan.tasks,
      duration,
    };
  }, [plan]);

  const GANTT_HEIGHT = 300;
  const ROW_HEIGHT = GANTT_HEIGHT / agentRows.size;
  const TIMELINE_WIDTH = 800;

  const statusColor: Record<string, string> = {
    pending: "bg-slate-500",
    running: "bg-blue-500 animate-pulse",
    done: "bg-emerald-500",
    failed: "bg-rose-500",
    skipped: "bg-slate-600",
  };

  const getTaskBarStyle = (task: SwarmTask) => {
    if (!task.startedAt || !task.finishedAt) {
      return null;
    }

    const rowIdx = agentRows.get(task.agentId) || 0;
    const top = rowIdx * ROW_HEIGHT;
    const taskDuration = task.finishedAt - task.startedAt;
    const planDuration = timelineEnd - timelineStart;

    const left =
      ((task.startedAt - timelineStart) / planDuration) * TIMELINE_WIDTH;
    const width = (taskDuration / planDuration) * TIMELINE_WIDTH;

    return {
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.max(width, 30)}px`,
      height: `${ROW_HEIGHT * 0.7}px`,
    };
  };

  return (
    <div className="p-4 border border-slate-700 rounded-lg bg-slate-900">
      <h3 className="text-sm font-bold text-slate-200 mb-4">Gantt Timeline</h3>

      <div className="flex gap-4">
        {/* Agent labels */}
        <div className="flex flex-col" style={{ minWidth: "100px" }}>
          {Array.from(agentRows.entries())
            .sort((a, b) => a[1] - b[1])
            .map(([agentId]) => (
              <div
                key={agentId}
                className="text-xs font-semibold text-slate-300 uppercase"
                style={{ height: `${ROW_HEIGHT}px`, lineHeight: `${ROW_HEIGHT}px` }}
              >
                {agentId}
              </div>
            ))}
        </div>

        {/* Gantt bars */}
        <div
          className="relative border border-slate-700 bg-slate-800 rounded"
          style={{
            width: `${TIMELINE_WIDTH}px`,
            height: `${GANTT_HEIGHT}px`,
          }}
        >
          {tasks.map((task) => {
            const barStyle = getTaskBarStyle(task);
            if (!barStyle) {
              return null;
            }

            return (
              <div
                key={task.id}
                className={`absolute rounded transition-all ${statusColor[task.status]} hover:ring-2 hover:ring-slate-400 cursor-pointer group`}
                style={barStyle}
                title={`${task.title} (${task.status})`}
              >
                <div className="absolute -top-6 left-0 bg-slate-700 text-slate-100 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">
                  {task.title}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-500" />
          Pending
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-blue-500 animate-pulse" />
          Running
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-emerald-500" />
          Done
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-rose-500" />
          Failed
        </div>
      </div>

      {/* TODO: dep lines (стрелки между bar'ами для визуализации зависимостей) */}
    </div>
  );
}
