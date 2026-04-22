/**
 * lib/analytics/waterfallStore.ts
 *
 * Transforms UsageRecord[] into stacked-bar / waterfall series data
 * consumed by CostWaterfallChart.
 *
 * Breakdown dimensions
 *   date      → X-axis buckets (one bar per day)
 *   model     → stacked colour segments inside each bar
 *   category  → derived from record.task; shown in tooltip drilldown
 */

import {
  type UsageRecord,
  type ModelId,
  MODEL_PRICING,
  costStore,
} from "./costStore";

// ─── Public types ─────────────────────────────────────────────────────────────

export interface WaterfallDayBucket {
  date: string;                          // "YYYY-MM-DD"
  label: string;                         // "Mon 21"
  byModel: Partial<Record<ModelId, number>>;   // model → costUsd
  byCategory: Record<string, number>;    // category → costUsd
  total: number;
}

export interface WaterfallModel {
  id: ModelId | string;
  label: string;
  color: string;
}

export interface WaterfallSeries {
  days: WaterfallDayBucket[];
  models: WaterfallModel[];      // sorted by total cost desc
  categories: string[];          // sorted by total cost desc
  totalCostUsd: number;
}

// ─── Category derivation ──────────────────────────────────────────────────────

const CATEGORY_MAP: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /uefn|verse|fortnite/i,       category: "UEFN/Game" },
  { pattern: /telegram|bot/i,              category: "Telegram" },
  { pattern: /next|dashboard|ui|theme/i,   category: "Frontend" },
  { pattern: /db|schema|migration/i,       category: "Database" },
  { pattern: /debug|fix|error/i,           category: "Debugging" },
  { pattern: /agent|overnight|scout/i,     category: "Agent Ops" },
  { pattern: /cost/i,                      category: "Analytics" },
];

export function deriveCategory(task?: string): string {
  if (!task) return "Uncategorized";
  for (const { pattern, category } of CATEGORY_MAP) {
    if (pattern.test(task)) return category;
  }
  return "Other";
}

// ─── Core transform ───────────────────────────────────────────────────────────

/**
 * Build a WaterfallSeries from a flat UsageRecord array.
 *
 * @param records  Raw usage records (any time range).
 * @param days     How many calendar days to bucket (e.g. 7, 14, 30).
 */
export function buildWaterfallSeries(
  records: UsageRecord[],
  days: number,
): WaterfallSeries {
  const now = new Date();

  // Pre-build ordered day buckets
  const dayBuckets: WaterfallDayBucket[] = Array.from({ length: days }, (_, i) => {
    const day = new Date(now);
    day.setDate(now.getDate() - (days - 1 - i));
    const date = day.toISOString().slice(0, 10);
    const label = day.toLocaleDateString("en", {
      weekday: "short",
      day: "numeric",
    });
    return { date, label, byModel: {}, byCategory: {}, total: 0 };
  });

  // Build a fast lookup: date string → bucket index
  const dateIndex = new Map<string, number>(
    dayBuckets.map((b, i) => [b.date, i]),
  );

  const cutoff = Date.now() - days * 24 * 3600 * 1000;

  for (const r of records) {
    if (new Date(r.ts).getTime() < cutoff) continue;

    const date = r.ts.slice(0, 10);
    const idx = dateIndex.get(date);
    if (idx === undefined) continue;

    const bucket = dayBuckets[idx];

    // Model breakdown
    const prev = bucket.byModel[r.model] ?? 0;
    bucket.byModel[r.model] = prev + r.costUsd;

    // Category breakdown
    const cat = deriveCategory(r.task);
    bucket.byCategory[cat] = (bucket.byCategory[cat] ?? 0) + r.costUsd;

    bucket.total += r.costUsd;
  }

  // Collect unique models sorted by total spend desc
  const modelTotals = new Map<string, number>();
  for (const b of dayBuckets) {
    for (const [m, cost] of Object.entries(b.byModel)) {
      modelTotals.set(m, (modelTotals.get(m) ?? 0) + cost);
    }
  }

  const models: WaterfallModel[] = [...modelTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => {
      const p = MODEL_PRICING[id as ModelId];
      return { id, label: p?.label ?? id, color: p?.color ?? "#888" };
    });

  // Collect unique categories sorted by total spend desc
  const catTotals = new Map<string, number>();
  for (const b of dayBuckets) {
    for (const [c, cost] of Object.entries(b.byCategory)) {
      catTotals.set(c, (catTotals.get(c) ?? 0) + cost);
    }
  }
  const categories = [...catTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);

  const totalCostUsd = dayBuckets.reduce((s, b) => s + b.total, 0);

  return { days: dayBuckets, models, categories, totalCostUsd };
}

// ─── Convenience wrapper (reads from costStore) ───────────────────────────────

export function getWaterfallSeries(days = 7): WaterfallSeries {
  return buildWaterfallSeries(costStore.getRecords(), days);
}
