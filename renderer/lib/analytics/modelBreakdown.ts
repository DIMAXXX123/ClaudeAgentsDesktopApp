/**
 * lib/analytics/modelBreakdown.ts
 *
 * Pure functions for per-model cost breakdown table data.
 * Consumed by ModelCostBreakdownTable and /api/analytics/model-breakdown.
 */

import {
  type UsageRecord,
  type ModelId,
  MODEL_PRICING,
} from "./costStore";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface ModelBreakdownRow {
  model: ModelId | string;
  label: string;
  color: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  avgCostPerCall: number;
  pctOfTotal: number;      // 0-100
}

export interface ModelBreakdownResult {
  rows: ModelBreakdownRow[];          // sorted by costUsd desc
  totalCostUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  periodDays: number;
}

// ─── Core computation ─────────────────────────────────────────────────────────

export function buildModelBreakdown(
  records: UsageRecord[],
  days: number,
): ModelBreakdownResult {
  const cutoff = Date.now() - days * 24 * 3600 * 1000;
  const filtered = records.filter((r) => new Date(r.ts).getTime() >= cutoff);

  const acc = new Map<string, ModelBreakdownRow>();

  for (const r of filtered) {
    if (!acc.has(r.model)) {
      const p = MODEL_PRICING[r.model as ModelId];
      acc.set(r.model, {
        model: r.model,
        label: p?.label ?? r.model,
        color: p?.color ?? "#888888",
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        costUsd: 0,
        avgCostPerCall: 0,
        pctOfTotal: 0,
      });
    }

    const row = acc.get(r.model)!;
    row.calls += 1;
    row.inputTokens += r.inputTokens;
    row.outputTokens += r.outputTokens;
    row.totalTokens += r.inputTokens + r.outputTokens;
    row.costUsd += r.costUsd;
  }

  const totalCostUsd = [...acc.values()].reduce((s, r) => s + r.costUsd, 0);
  const totalCalls = [...acc.values()].reduce((s, r) => s + r.calls, 0);
  const totalInputTokens = [...acc.values()].reduce((s, r) => s + r.inputTokens, 0);
  const totalOutputTokens = [...acc.values()].reduce((s, r) => s + r.outputTokens, 0);

  // Finalise derived fields
  for (const row of acc.values()) {
    row.avgCostPerCall = row.calls > 0 ? row.costUsd / row.calls : 0;
    row.pctOfTotal = totalCostUsd > 0 ? (row.costUsd / totalCostUsd) * 100 : 0;
  }

  const rows = [...acc.values()].sort((a, b) => b.costUsd - a.costUsd);

  return { rows, totalCostUsd, totalCalls, totalInputTokens, totalOutputTokens, periodDays: days };
}

// ─── CSV export helper ────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Model",
  "Label",
  "Calls",
  "Input Tokens",
  "Output Tokens",
  "Total Tokens",
  "Cost USD",
  "Avg Cost / Call",
  "% of Total",
];

function esc(v: string | number): string {
  const s = String(v);
  // Quote if the value contains commas, quotes, or newlines
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function breakdownToCsv(result: ModelBreakdownResult): string {
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const row of result.rows) {
    lines.push(
      [
        esc(row.model),
        esc(row.label),
        esc(row.calls),
        esc(row.inputTokens),
        esc(row.outputTokens),
        esc(row.totalTokens),
        esc(row.costUsd.toFixed(6)),
        esc(row.avgCostPerCall.toFixed(6)),
        esc(row.pctOfTotal.toFixed(2)),
      ].join(","),
    );
  }

  // Summary row
  lines.push(
    [
      esc("TOTAL"),
      esc(""),
      esc(result.totalCalls),
      esc(result.totalInputTokens),
      esc(result.totalOutputTokens),
      esc(result.totalInputTokens + result.totalOutputTokens),
      esc(result.totalCostUsd.toFixed(6)),
      esc(""),
      esc("100.00"),
    ].join(","),
  );

  return lines.join("\n");
}
