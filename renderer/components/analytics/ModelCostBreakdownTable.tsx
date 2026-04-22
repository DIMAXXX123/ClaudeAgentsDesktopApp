"use client";

/**
 * components/analytics/ModelCostBreakdownTable.tsx
 *
 * Per-model cost breakdown table with CSV export.
 * Reads directly from costStore so it stays in sync with CostWaterfallChart.
 *
 * Features
 * ─────────
 * • Tabular breakdown: model, calls, tokens (in/out), cost, % share
 * • Day-range filter: 7 / 14 / 30 days
 * • CSV download button — triggers browser file save via Blob URL
 * • Auto-refresh every 15 s via costStore subscription
 * • Zero-state: placeholder row when no records exist
 */

import { useCallback, useEffect, useState } from "react";
import { costStore } from "@/lib/analytics/costStore";
import {
  buildModelBreakdown,
  breakdownToCsv,
  type ModelBreakdownResult,
  type ModelBreakdownRow,
} from "@/lib/analytics/modelBreakdown";

// ─── Types ────────────────────────────────────────────────────────────────────

type DayRange = 7 | 14 | 30;

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v === 0) return "$0";
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.001) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ─── CSV download ─────────────────────────────────────────────────────────────

function downloadCsv(result: ModelBreakdownResult, days: DayRange) {
  const csv = breakdownToCsv(result);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `model-breakdown-${days}d.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PctBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="relative h-1 w-full rounded-full bg-white/10 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, opacity: 0.8 }}
      />
    </div>
  );
}

function TableRow({ row }: { row: ModelBreakdownRow }) {
  return (
    <tr className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
      {/* Model */}
      <td className="py-1.5 px-2 whitespace-nowrap">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-1.5 h-3.5 rounded-sm flex-shrink-0"
            style={{ backgroundColor: row.color }}
          />
          <span className="text-[10px] font-mono opacity-80">{row.label}</span>
        </div>
      </td>

      {/* Calls */}
      <td className="py-1.5 px-2 text-right tabular-nums text-[10px] font-mono opacity-60">
        {row.calls}
      </td>

      {/* Input tokens */}
      <td className="py-1.5 px-2 text-right tabular-nums text-[10px] font-mono opacity-50">
        {fmtTokens(row.inputTokens)}
      </td>

      {/* Output tokens */}
      <td className="py-1.5 px-2 text-right tabular-nums text-[10px] font-mono opacity-50">
        {fmtTokens(row.outputTokens)}
      </td>

      {/* Cost */}
      <td className="py-1.5 px-2 text-right tabular-nums text-[10px] font-mono text-[var(--ut-accent,#38bdf8)]">
        {fmtUsd(row.costUsd)}
      </td>

      {/* Avg / call */}
      <td className="py-1.5 px-2 text-right tabular-nums text-[10px] font-mono opacity-40">
        {fmtUsd(row.avgCostPerCall)}
      </td>

      {/* % bar */}
      <td className="py-1.5 px-2 min-w-[80px]">
        <div className="flex items-center gap-1.5">
          <PctBar pct={row.pctOfTotal} color={row.color} />
          <span className="text-[9px] font-mono opacity-50 tabular-nums w-[30px] text-right flex-shrink-0">
            {fmtPct(row.pctOfTotal)}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ModelCostBreakdownTable() {
  const [range, setRange] = useState<DayRange>(7);
  const [result, setResult] = useState<ModelBreakdownResult | null>(null);
  const [lastUpdated, setLastUpdated] = useState("");

  const refresh = useCallback(() => {
    const records = costStore.getRecords();
    setResult(buildModelBreakdown(records, range));
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

  if (!result) {
    return (
      <div className="neon-frame rounded-lg p-4 text-xs font-mono opacity-60">
        Loading breakdown…
      </div>
    );
  }

  const hasData = result.rows.length > 0;

  return (
    <div className="neon-frame rounded-lg p-3 flex flex-col gap-2 font-mono select-none">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-[var(--ut-border)] pb-2">
        <span className="text-xs tracking-widest uppercase opacity-50">
          📋 Model Breakdown
        </span>

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

        {/* CSV export */}
        <button
          onClick={() => downloadCsv(result, range)}
          disabled={!hasData}
          title="Export as CSV"
          className={[
            "text-[10px] px-2 py-0.5 rounded border transition-colors",
            hasData
              ? "border-[var(--ut-border)] opacity-60 hover:opacity-90 hover:border-[var(--ut-accent,#38bdf8)]"
              : "border-white/10 opacity-20 cursor-not-allowed",
          ].join(" ")}
        >
          ↓ CSV
        </button>
      </div>

      {/* ── Summary KPIs ── */}
      <div className="grid grid-cols-3 gap-1.5">
        {[
          { label: "Total Cost", value: fmtUsd(result.totalCostUsd) },
          { label: "Total Calls", value: String(result.totalCalls) },
          { label: "Total Tokens", value: fmtTokens(result.totalInputTokens + result.totalOutputTokens) },
        ].map(({ label, value }) => (
          <div key={label} className="rounded bg-white/5 px-2 py-1.5">
            <span className="block text-[9px] uppercase tracking-widest opacity-40">
              {label}
            </span>
            <span className="text-sm font-bold tabular-nums text-[var(--ut-accent,#38bdf8)] leading-none">
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="rounded bg-white/5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10">
              {["Model", "Calls", "In Tok", "Out Tok", "Cost", "Avg/Call", "Share"].map((h) => (
                <th
                  key={h}
                  className="py-1 px-2 text-[9px] uppercase tracking-widest opacity-30 font-normal whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hasData ? (
              result.rows.map((row) => <TableRow key={row.model} row={row} />)
            ) : (
              <tr>
                <td
                  colSpan={7}
                  className="py-4 text-center text-[10px] opacity-30"
                >
                  No records in the last {range} days
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between border-t border-[var(--ut-border)] pt-1.5">
        <span className="text-[9px] opacity-30 tabular-nums">↻ {lastUpdated}</span>
        <span className="text-[9px] opacity-25">last {range} days · {result.rows.length} models</span>
      </div>
    </div>
  );
}
