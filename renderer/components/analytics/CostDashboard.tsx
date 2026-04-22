"use client";

/**
 * components/analytics/CostDashboard.tsx
 *
 * Cost dashboard panel — shows Claude API spend grouped by model.
 * Data source: client localStorage via costStore (seeded on first render).
 *
 * Features:
 * - Total spend KPI + per-model breakdown
 * - Horizontal bar chart (pure Tailwind, no canvas dependency)
 * - Sparkline-style 7-day area chart via SVG
 * - Day-range filter (1 / 7 / 30 days)
 * - Per-model token table
 * - Reset button (clears localStorage seed)
 * - Auto-refreshes every 10s to pick up new records
 */

import { useEffect, useState, useCallback } from "react";
import {
  costStore,
  MODEL_PRICING,
  aggregateRecords,
  type CostSummary,
  type ModelId,
  type UsageRecord,
} from "@/lib/analytics/costStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayRange = 1 | 7 | 30;

interface DayBucket {
  label: string;       // e.g. "Mon 21"
  date: string;        // YYYY-MM-DD
  costUsd: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterByDays(records: UsageRecord[], days: DayRange): UsageRecord[] {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  return records.filter((r) => new Date(r.ts).getTime() >= cutoff);
}

function buildDayBuckets(records: UsageRecord[], days: DayRange): DayBucket[] {
  const now = new Date();
  const buckets: DayBucket[] = [];

  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now);
    day.setDate(now.getDate() - d);
    const dateStr = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString("en", { weekday: "short", day: "numeric" });
    buckets.push({ label, date: dateStr, costUsd: 0 });
  }

  for (const r of records) {
    const date = r.ts.slice(0, 10);
    const bucket = buckets.find((b) => b.date === date);
    if (bucket) bucket.costUsd += r.costUsd;
  }

  return buckets;
}

function fmtUsd(v: number, decimals = 4): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(decimals)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Mini SVG Sparkline ───────────────────────────────────────────────────────

function Sparkline({ buckets }: { buckets: DayBucket[] }) {
  const W = 280;
  const H = 50;
  const PAD = 4;

  const costs = buckets.map((b) => b.costUsd);
  const max = Math.max(...costs, 0.00001);

  const points = costs.map((c, i) => {
    const x = PAD + (i / Math.max(costs.length - 1, 1)) * (W - PAD * 2);
    const y = H - PAD - ((c / max) * (H - PAD * 2));
    return { x, y };
  });

  const pathD =
    points.length < 2
      ? ""
      : points.reduce((d, p, i) => {
          if (i === 0) return `M ${p.x} ${p.y}`;
          // Smooth cubic bezier
          const prev = points[i - 1];
          const cpx = (prev.x + p.x) / 2;
          return `${d} C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
        }, "");

  const areaD = pathD
    ? `${pathD} L ${points[points.length - 1].x} ${H - PAD} L ${points[0].x} ${H - PAD} Z`
    : "";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: H }}
      aria-hidden
    >
      <defs>
        <linearGradient id="cost-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaD && <path d={areaD} fill="url(#cost-gradient)" />}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="#38bdf8"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      )}
      {/* dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={2} fill="#38bdf8" />
      ))}
    </svg>
  );
}

// ─── Bar row for a model ──────────────────────────────────────────────────────

function ModelBar({
  label,
  color,
  costUsd,
  pct,
  calls,
  inputTokens,
  outputTokens,
}: {
  label: string;
  color: string;
  costUsd: number;
  pct: number;
  calls: number;
  inputTokens: number;
  outputTokens: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="truncate opacity-90">{label}</span>
          <span className="opacity-40 text-[10px]">{calls}×</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="opacity-50 text-[10px]">
            {fmtTokens(inputTokens)}↓ {fmtTokens(outputTokens)}↑
          </span>
          <span className="font-bold tabular-nums">{fmtUsd(costUsd)}</span>
          <span className="opacity-40 w-8 text-right">{pct.toFixed(0)}%</span>
        </div>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ─── Main CostDashboard ───────────────────────────────────────────────────────

export function CostDashboard() {
  const [range, setRange] = useState<DayRange>(7);
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [buckets, setBuckets] = useState<DayBucket[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");

  const refresh = useCallback(() => {
    const allRecords = costStore.getRecords();
    const filtered = filterByDays(allRecords, range);
    setSummary(aggregateRecords(filtered));
    setBuckets(buildDayBuckets(filtered, range));
    setLastUpdated(new Date().toLocaleTimeString());
  }, [range]);

  useEffect(() => {
    refresh();
    const unsub = costStore.subscribe(refresh);
    const timer = setInterval(refresh, 10_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refresh]);

  const handleReset = () => {
    costStore.clear();
    refresh();
  };

  if (!summary) {
    return (
      <div className="neon-frame rounded-lg p-4 text-xs font-mono opacity-60">
        Loading cost data…
      </div>
    );
  }

  const RANGES: DayRange[] = [1, 7, 30];

  return (
    <div className="neon-frame rounded-lg p-3 flex flex-col gap-3 select-none font-mono">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-[var(--ut-border)] pb-2">
        <span className="text-xs tracking-widest uppercase opacity-50">
          💰 Cost Dashboard
        </span>
        <div className="ml-auto flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={[
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                range === r
                  ? "bg-[var(--ut-accent)] text-black"
                  : "opacity-40 hover:opacity-70",
              ].join(" ")}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            {
              label: "Total Spend",
              value: fmtUsd(summary.totalCostUsd, 2),
              accent: true,
            },
            {
              label: "API Calls",
              value: summary.totalCalls.toLocaleString(),
              accent: false,
            },
            {
              label: "Tokens",
              value: fmtTokens(
                summary.totalInputTokens + summary.totalOutputTokens,
              ),
              accent: false,
            },
          ] as const
        ).map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded bg-white/5 px-2 py-1.5 flex flex-col gap-0.5"
          >
            <span className="text-[9px] uppercase tracking-widest opacity-40">
              {label}
            </span>
            <span
              className={[
                "text-base font-bold tabular-nums leading-none",
                accent ? "text-[var(--ut-accent)]" : "opacity-90",
              ].join(" ")}
            >
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Sparkline ── */}
      {buckets.length > 1 && (
        <div className="rounded bg-white/5 px-2 py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] uppercase tracking-widest opacity-40">
              Daily spend
            </span>
            <span className="text-[10px] opacity-40">
              {buckets[0].label} → {buckets[buckets.length - 1].label}
            </span>
          </div>
          <Sparkline buckets={buckets} />
        </div>
      )}

      {/* ── Model bars ── */}
      {summary.byModel.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-[9px] uppercase tracking-widest opacity-40">
            By model
          </span>
          {summary.byModel.map((m) => (
            <ModelBar
              key={m.model}
              label={m.label}
              color={m.color}
              costUsd={m.costUsd}
              pct={m.pct}
              calls={m.calls}
              inputTokens={m.inputTokens}
              outputTokens={m.outputTokens}
            />
          ))}
        </div>
      ) : (
        <div className="text-[11px] opacity-40 text-center py-2">
          No data for this range
        </div>
      )}

      {/* ── Pricing reference ── */}
      <details className="group">
        <summary className="text-[9px] uppercase tracking-widest opacity-30 hover:opacity-60 cursor-pointer transition-opacity">
          Pricing reference ▾
        </summary>
        <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
          {(Object.entries(MODEL_PRICING) as [ModelId, (typeof MODEL_PRICING)[ModelId]][]).map(
            ([id, p]) => (
              <div key={id} className="flex items-center gap-1 opacity-60">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate">{p.label}</span>
                <span className="ml-auto opacity-50 tabular-nums">
                  ${p.inputPer1M}/${p.outputPer1M}
                </span>
              </div>
            ),
          )}
        </div>
      </details>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-[var(--ut-border)] pt-2">
        <span className="text-[9px] opacity-30 tabular-nums">
          ↻ {lastUpdated}
        </span>
        <button
          onClick={handleReset}
          className="text-[9px] opacity-30 hover:opacity-70 hover:text-red-400 transition-colors"
          title="Clear all cost records (reseed demo data)"
        >
          reset
        </button>
      </div>
    </div>
  );
}
