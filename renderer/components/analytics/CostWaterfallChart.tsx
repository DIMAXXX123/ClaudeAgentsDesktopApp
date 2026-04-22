"use client";

/**
 * components/analytics/CostWaterfallChart.tsx
 *
 * Token-cost waterfall chart: stacked BarChart broken down by model, date,
 * and prompt category.  Built with pure SVG — no Recharts / canvas required.
 *
 * Features
 * ─────────
 * • Stacked bars  : each bar = one day, segments = models (or categories)
 * • Cumulative line overlay  : running total across days
 * • Hover tooltip  : date, total, per-segment breakdown
 * • Day-range filter  : 7 / 14 / 30 days
 * • Dimension toggle  : "By Model" vs "By Category"
 * • Responsive SVG  : scales to container width
 * • Auto-refresh every 15 s from costStore
 */

import { useEffect, useRef, useState, useCallback, type MouseEvent } from "react";
import {
  getWaterfallSeries,
  type WaterfallSeries,
  type WaterfallDayBucket,
} from "@/lib/analytics/waterfallStore";
import { costStore } from "@/lib/analytics/costStore";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayRange = 7 | 14 | 30;
type Dimension = "model" | "category";

interface TooltipData {
  bucket: WaterfallDayBucket;
  segments: Array<{ label: string; color: string; value: number }>;
  x: number;
  y: number;
}

// ─── Colours for categories (model colours come from MODEL_PRICING) ───────────

const CATEGORY_COLORS: Record<string, string> = {
  "UEFN/Game":   "#f59e0b",
  "Telegram":    "#22d3ee",
  "Frontend":    "#a78bfa",
  "Database":    "#f472b6",
  "Debugging":   "#ef4444",
  "Agent Ops":   "#34d399",
  "Analytics":   "#38bdf8",
  "Other":       "#94a3b8",
  "Uncategorized": "#475569",
};

function catColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? "#94a3b8";
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v === 0) return "$0";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtYAxis(v: number): string {
  if (v >= 1) return `$${v.toFixed(1)}`;
  if (v >= 0.01) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(5)}`;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function Tooltip({ data, svgWidth }: { data: TooltipData; svgWidth: number }) {
  const W = 170;
  const flipX = data.x + W + 16 > svgWidth;
  const tx = flipX ? data.x - W - 8 : data.x + 8;
  const ty = Math.max(4, data.y - 40);

  return (
    <g>
      <foreignObject x={tx} y={ty} width={W} height={200} style={{ overflow: "visible" }}>
        <div
          className="rounded border border-white/10 bg-[#0f1117]/95 px-2.5 py-2 font-mono text-[10px] shadow-lg pointer-events-none"
          style={{ width: W }}
        >
          <div className="font-bold text-[11px] mb-1.5 opacity-90">
            {data.bucket.label}
          </div>
          <div className="flex justify-between mb-1.5 border-b border-white/10 pb-1.5">
            <span className="opacity-50">Total</span>
            <span className="font-bold text-[var(--ut-accent,#38bdf8)]">
              {fmtUsd(data.bucket.total)}
            </span>
          </div>
          {data.segments.map((s) => (
            <div key={s.label} className="flex items-center justify-between gap-1.5 py-0.5">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate opacity-70">{s.label}</span>
              </div>
              <span className="tabular-nums flex-shrink-0">{fmtUsd(s.value)}</span>
            </div>
          ))}
        </div>
      </foreignObject>
    </g>
  );
}

// ─── Legend ───────────────────────────────────────────────────────────────────

function Legend({
  items,
}: {
  items: Array<{ id: string; label: string; color: string; total: number }>;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-1 font-mono text-[10px] opacity-70">
          <span
            className="inline-block w-2 h-2 rounded-sm flex-shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
          <span className="opacity-50 tabular-nums">{fmtUsd(item.total)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Chart ────────────────────────────────────────────────────────────────

const MARGIN = { top: 10, right: 8, bottom: 28, left: 48 };
const CHART_H = 160;

function WaterfallSVG({
  series,
  dimension,
  onHover,
}: {
  series: WaterfallSeries;
  dimension: Dimension;
  onHover: (data: TooltipData | null) => void;
}) {
  const containerRef = useRef<SVGSVGElement>(null);
  const [svgW, setSvgW] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setSvgW(w);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const plotW = svgW - MARGIN.left - MARGIN.right;
  const plotH = CHART_H - MARGIN.top - MARGIN.bottom;

  const { days } = series;
  const maxCost = Math.max(...days.map((d) => d.total), 0.000001);

  // Y-axis ticks (4 ticks)
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
    value: maxCost * f,
    y: plotH - plotH * f,
  }));

  // Bar geometry
  const barCount = days.length;
  const barGap = Math.max(2, plotW / barCount * 0.15);
  const barW = plotW / barCount - barGap;

  // Cumulative line points — normalize against totalCostUsd so the last
  // point always reaches chart-top (100 %) when viewing the full period.
  const totalForLine = series.totalCostUsd > 0 ? series.totalCostUsd : 0.000001;
  let cumulative = 0;
  const linePoints = days.map((d, i) => {
    cumulative += d.total;
    const x = MARGIN.left + i * (barW + barGap) + barW / 2 + barGap / 2;
    const y = MARGIN.top + plotH - (cumulative / totalForLine) * plotH;
    return { x, y };
  });

  const linePath = linePoints.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = linePoints[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${d} C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }, "");

  // Segment data per day
  function getSegments(bucket: WaterfallDayBucket) {
    if (dimension === "model") {
      return series.models.map((m) => ({
        id: m.id,
        label: m.label,
        color: m.color,
        value: (bucket.byModel as Record<string, number | undefined>)[m.id] ?? 0,
      })).filter((s) => s.value > 0);
    }
    // category
    return series.categories.map((cat) => ({
      id: cat,
      label: cat,
      color: catColor(cat),
      value: bucket.byCategory[cat] ?? 0,
    })).filter((s) => s.value > 0);
  }

  function handleMouseMove(e: MouseEvent<SVGSVGElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left - MARGIN.left;
    const slotW = barW + barGap;
    const idx = Math.floor(mx / slotW);
    if (idx < 0 || idx >= days.length) {
      onHover(null);
      return;
    }
    const bucket = days[idx];
    const segs = getSegments(bucket);
    const bx = MARGIN.left + idx * slotW + barW / 2;
    const by = MARGIN.top + plotH - (bucket.total / maxCost) * plotH;
    onHover({ bucket, segments: segs, x: bx, y: by });
  }

  return (
    <svg
      ref={containerRef}
      className="w-full"
      height={CHART_H}
      viewBox={`0 0 ${svgW} ${CHART_H}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
    >
      {/* Y-axis grid lines */}
      {yTicks.slice(1).map((tick, i) => (
        <line
          key={i}
          x1={MARGIN.left}
          y1={MARGIN.top + tick.y}
          x2={MARGIN.left + plotW}
          y2={MARGIN.top + tick.y}
          stroke="rgba(255,255,255,0.06)"
          strokeDasharray="3 3"
        />
      ))}

      {/* Y-axis labels */}
      {yTicks.slice(1).map((tick, i) => (
        <text
          key={i}
          x={MARGIN.left - 4}
          y={MARGIN.top + tick.y + 3}
          textAnchor="end"
          fill="rgba(255,255,255,0.35)"
          fontSize={8}
          fontFamily="monospace"
        >
          {fmtYAxis(tick.value)}
        </text>
      ))}

      {/* Stacked bars */}
      {days.map((bucket, i) => {
        const segs = getSegments(bucket);
        const bx = MARGIN.left + i * (barW + barGap) + barGap / 2;
        let stackY = MARGIN.top + plotH;

        return (
          <g key={bucket.date}>
            {segs.map((s) => {
              const segH = (s.value / maxCost) * plotH;
              stackY -= segH;
              return (
                <rect
                  key={s.id}
                  x={bx}
                  y={stackY}
                  width={barW}
                  height={segH}
                  fill={s.color}
                  opacity={0.85}
                  rx={1}
                />
              );
            })}
            {/* X-axis label */}
            <text
              x={bx + barW / 2}
              y={MARGIN.top + plotH + 14}
              textAnchor="middle"
              fill="rgba(255,255,255,0.35)"
              fontSize={barCount <= 7 ? 9 : 7}
              fontFamily="monospace"
            >
              {barCount <= 14
                ? bucket.label
                : bucket.date.slice(5) /* MM-DD if many bars */}
            </text>
          </g>
        );
      })}

      {/* Cumulative line overlay */}
      {linePath && (
        <>
          <path
            d={linePath}
            fill="none"
            stroke="rgba(251,191,36,0.7)"
            strokeWidth={1.5}
            strokeDasharray="4 2"
          />
          {linePoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={2} fill="#fbbf24" opacity={0.8} />
          ))}
        </>
      )}

      {/* Axes */}
      <line
        x1={MARGIN.left}
        y1={MARGIN.top}
        x2={MARGIN.left}
        y2={MARGIN.top + plotH}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />
      <line
        x1={MARGIN.left}
        y1={MARGIN.top + plotH}
        x2={MARGIN.left + plotW}
        y2={MARGIN.top + plotH}
        stroke="rgba(255,255,255,0.15)"
        strokeWidth={1}
      />
    </svg>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CostWaterfallChart() {
  const [range, setRange] = useState<DayRange>(7);
  const [dimension, setDimension] = useState<Dimension>("model");
  const [series, setSeries] = useState<WaterfallSeries | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const refresh = useCallback(() => {
    setSeries(getWaterfallSeries(range));
    setLastUpdated(new Date().toLocaleTimeString());
  }, [range]);

  useEffect(() => {
    refresh();
    const unsub = costStore.subscribe(refresh);
    const timer = setInterval(refresh, 15_000);
    return () => {
      unsub();
      clearInterval(timer);
    };
  }, [refresh]);

  const RANGES: DayRange[] = [7, 14, 30];

  // Legend items
  const legendItems =
    series == null
      ? []
      : dimension === "model"
      ? series.models.map((m) => ({
          id: m.id,
          label: m.label,
          color: m.color,
          total: series.days.reduce(
            (s, d) => s + ((d.byModel as Record<string, number>)[m.id] ?? 0),
            0,
          ),
        }))
      : series.categories.map((cat) => ({
          id: cat,
          label: cat,
          color: catColor(cat),
          total: series.days.reduce(
            (s, d) => s + (d.byCategory[cat] ?? 0),
            0,
          ),
        }));

  if (!series) {
    return (
      <div className="neon-frame rounded-lg p-4 text-xs font-mono opacity-60">
        Loading waterfall…
      </div>
    );
  }

  return (
    <div className="neon-frame rounded-lg p-3 flex flex-col gap-2 select-none font-mono">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-[var(--ut-border)] pb-2">
        <span className="text-xs tracking-widest uppercase opacity-50">
          📊 Cost Waterfall
        </span>

        {/* Dimension toggle */}
        <div className="flex items-center gap-0.5 ml-1">
          {(["model", "category"] as Dimension[]).map((d) => (
            <button
              key={d}
              onClick={() => setDimension(d)}
              className={[
                "text-[10px] px-1.5 py-0.5 rounded transition-colors capitalize",
                dimension === d
                  ? "bg-[var(--ut-accent,#38bdf8)] text-black"
                  : "opacity-40 hover:opacity-70",
              ].join(" ")}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Day range */}
        <div className="ml-auto flex items-center gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={[
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                range === r
                  ? "bg-[var(--ut-accent,#38bdf8)] text-black"
                  : "opacity-40 hover:opacity-70",
              ].join(" ")}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded bg-white/5 px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-widest opacity-40">
            Period Spend
          </span>
          <span className="text-base font-bold tabular-nums text-[var(--ut-accent,#38bdf8)] leading-none">
            {fmtUsd(series.totalCostUsd)}
          </span>
        </div>
        <div className="rounded bg-white/5 px-2 py-1.5">
          <span className="block text-[9px] uppercase tracking-widest opacity-40">
            Active Days
          </span>
          <span className="text-base font-bold tabular-nums opacity-90 leading-none">
            {series.days.filter((d) => d.total > 0).length} / {range}
          </span>
        </div>
      </div>

      {/* ── Chart ── */}
      {/* NOTE: no overflow-hidden — tooltip must not be clipped by container */}
      <div className="relative rounded bg-white/5 px-1 py-1">
        <WaterfallSVG
          series={series}
          dimension={dimension}
          onHover={setTooltip}
        />
        {/* Inline tooltip rendered over SVG */}
        {tooltip && (
          <div
            className="absolute pointer-events-none z-20"
            style={{
              left: tooltip.x,
              top: tooltip.y,
            }}
          >
            <div className="ml-2 -mt-10 rounded border border-white/10 bg-[#0f1117]/95 px-2.5 py-2 font-mono text-[10px] shadow-lg w-44">
              <div className="font-bold text-[11px] mb-1.5 opacity-90">
                {tooltip.bucket.label}
              </div>
              <div className="flex justify-between mb-1.5 border-b border-white/10 pb-1.5">
                <span className="opacity-50">Total</span>
                <span className="font-bold text-[var(--ut-accent,#38bdf8)]">
                  {fmtUsd(tooltip.bucket.total)}
                </span>
              </div>
              {tooltip.segments.slice(0, 6).map((s) => (
                <div
                  key={s.label}
                  className="flex items-center justify-between gap-1.5 py-0.5"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: s.color }}
                    />
                    <span className="truncate opacity-70 text-[9px]">{s.label}</span>
                  </div>
                  <span className="tabular-nums flex-shrink-0 text-[9px]">
                    {fmtUsd(s.value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Cumulative line legend */}
        <div className="absolute top-1 right-2 flex items-center gap-1 text-[9px] opacity-50 font-mono pointer-events-none">
          <svg width="16" height="6" viewBox="0 0 16 6">
            <line x1={0} y1={3} x2={16} y2={3} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 2" />
          </svg>
          cumulative
        </div>
      </div>

      {/* ── Legend ── */}
      {legendItems.length > 0 && <Legend items={legendItems} />}

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-[var(--ut-border)] pt-1.5">
        <span className="text-[9px] opacity-30 tabular-nums">↻ {lastUpdated}</span>
        <span className="text-[9px] opacity-25">
          stacked by {dimension} · cumulative line
        </span>
      </div>
    </div>
  );
}
