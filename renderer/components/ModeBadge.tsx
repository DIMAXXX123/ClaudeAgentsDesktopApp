'use client';

import { useUltronosMode } from '@/lib/useUltronosMode';

export function ModeBadge() {
  const { mode, config, loading } = useUltronosMode();

  if (loading || !config) {
    return null;
  }

  return (
    <div
      title={`${config.label} · ${config.description}\nPlanner: ${config.plannerModel}\nWorker: ${config.workerModel}\nMax Parallel: ${config.maxParallel}`}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors cursor-default"
    >
      <span className="text-sm">{config.icon}</span>
      <span>{config.label}</span>
    </div>
  );
}
