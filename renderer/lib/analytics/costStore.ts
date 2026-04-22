/**
 * lib/analytics/costStore.ts
 *
 * Client-side cost tracking store for Claude API usage.
 * Persists per-model usage records to localStorage so the dashboard
 * survives page reloads without a backend database.
 *
 * Pricing is based on Anthropic's published rates (as of 2026-04):
 *   claude-opus-4    — $15 / 1M input,  $75 / 1M output
 *   claude-sonnet-4  — $3  / 1M input,  $15 / 1M output
 *   claude-haiku-4   — $0.80 / 1M input, $4  / 1M output
 */

export type ModelId =
  | "claude-opus-4"
  | "claude-sonnet-4"
  | "claude-haiku-4"
  | "claude-opus-4-5"
  | "claude-sonnet-4-5"
  | "claude-haiku-4-5";

export interface ModelPricing {
  label: string;
  color: string;
  inputPer1M: number;   // USD per 1M input tokens
  outputPer1M: number;  // USD per 1M output tokens
}

export const MODEL_PRICING: Record<ModelId, ModelPricing> = {
  "claude-opus-4": {
    label: "Opus 4",
    color: "#a78bfa",
    inputPer1M: 15,
    outputPer1M: 75,
  },
  "claude-opus-4-5": {
    label: "Opus 4.5",
    color: "#c4b5fd",
    inputPer1M: 15,
    outputPer1M: 75,
  },
  "claude-sonnet-4": {
    label: "Sonnet 4",
    color: "#38bdf8",
    inputPer1M: 3,
    outputPer1M: 15,
  },
  "claude-sonnet-4-5": {
    label: "Sonnet 4.5",
    color: "#7dd3fc",
    inputPer1M: 3,
    outputPer1M: 15,
  },
  "claude-haiku-4": {
    label: "Haiku 4",
    color: "#4ade80",
    inputPer1M: 0.8,
    outputPer1M: 4,
  },
  "claude-haiku-4-5": {
    label: "Haiku 4.5",
    color: "#86efac",
    inputPer1M: 0.8,
    outputPer1M: 4,
  },
};

export interface UsageRecord {
  id: string;
  ts: string;           // ISO timestamp
  model: ModelId;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  sessionId?: string;
  task?: string;
}

export interface ModelAggregate {
  model: ModelId;
  label: string;
  color: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  pct: number;          // percentage of total cost (0-100)
}

export interface CostSummary {
  totalCostUsd: number;
  totalCalls: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  byModel: ModelAggregate[];
  records: UsageRecord[];
}

// ─── Pricing helpers ──────────────────────────────────────────────────────────

export function calcCost(
  model: ModelId,
  inputTokens: number,
  outputTokens: number,
): number {
  const p = MODEL_PRICING[model];
  return (
    (inputTokens * p.inputPer1M) / 1_000_000 +
    (outputTokens * p.outputPer1M) / 1_000_000
  );
}

// ─── Persistence (localStorage) ───────────────────────────────────────────────

const STORAGE_KEY = "ultronos:cost-records";
const MAX_RECORDS = 1000;

function _loadRecords(): UsageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as UsageRecord[];
  } catch {
    return [];
  }
}

function _saveRecords(records: UsageRecord[]) {
  if (typeof window === "undefined") return;
  // Trim to MAX_RECORDS (keep newest)
  const trimmed = records.slice(-MAX_RECORDS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export function aggregateRecords(records: UsageRecord[]): CostSummary {
  const byModel = new Map<ModelId, ModelAggregate>();

  for (const r of records) {
    if (!byModel.has(r.model)) {
      const pricing = MODEL_PRICING[r.model];
      byModel.set(r.model, {
        model: r.model,
        label: pricing?.label ?? r.model,
        color: pricing?.color ?? "#888",
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        pct: 0,
      });
    }
    const agg = byModel.get(r.model)!;
    agg.calls += 1;
    agg.inputTokens += r.inputTokens;
    agg.outputTokens += r.outputTokens;
    agg.costUsd += r.costUsd;
  }

  const totalCostUsd = [...byModel.values()].reduce((s, a) => s + a.costUsd, 0);

  // Compute percentages
  for (const agg of byModel.values()) {
    agg.pct = totalCostUsd > 0 ? (agg.costUsd / totalCostUsd) * 100 : 0;
  }

  const byModelArr = [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd);

  return {
    totalCostUsd,
    totalCalls: records.length,
    totalInputTokens: records.reduce((s, r) => s + r.inputTokens, 0),
    totalOutputTokens: records.reduce((s, r) => s + r.outputTokens, 0),
    byModel: byModelArr,
    records,
  };
}

// ─── Seed helpers (for demo / fresh installs) ────────────────────────────────

const SESSION_NAMES = [
  "UEFN map refactor",
  "Telegram bot fix",
  "Next.js dashboard",
  "DB schema migration",
  "Cost dashboard impl",
  "Overnight agent run",
  "Debug scout worker",
  "Theme system build",
];

function _randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate realistic-looking seed records spanning the last 7 days.
 * Called once on fresh installs so the dashboard isn't empty.
 */
export function generateSeedRecords(count = 60): UsageRecord[] {
  const now = Date.now();
  const records: UsageRecord[] = [];

  const modelWeights: Array<[ModelId, number]> = [
    ["claude-opus-4", 5],
    ["claude-opus-4-5", 8],
    ["claude-sonnet-4", 20],
    ["claude-sonnet-4-5", 35],
    ["claude-haiku-4", 12],
    ["claude-haiku-4-5", 20],
  ];

  // Weighted random model picker
  const totalWeight = modelWeights.reduce((s, [, w]) => s + w, 0);
  function pickModel(): ModelId {
    let r = Math.random() * totalWeight;
    for (const [m, w] of modelWeights) {
      r -= w;
      if (r <= 0) return m;
    }
    return "claude-sonnet-4-5";
  }

  for (let i = 0; i < count; i++) {
    const tsOffset = _randInt(0, 7 * 24 * 3600 * 1000);
    const ts = new Date(now - tsOffset).toISOString();
    const model = pickModel();
    const isLargeTask = Math.random() < 0.2;
    const inputTokens = isLargeTask ? _randInt(8000, 50000) : _randInt(500, 8000);
    const outputTokens = isLargeTask ? _randInt(2000, 12000) : _randInt(100, 2000);
    const costUsd = calcCost(model, inputTokens, outputTokens);

    records.push({
      id: `seed-${i}-${Date.now()}`,
      ts,
      model,
      inputTokens,
      outputTokens,
      costUsd,
      sessionId: `sess-${_randInt(1, 12)}`,
      task: SESSION_NAMES[_randInt(0, SESSION_NAMES.length - 1)],
    });
  }

  return records.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

// ─── Public store API ─────────────────────────────────────────────────────────

const _listeners = new Set<() => void>();

function _emit() {
  _listeners.forEach((l) => l());
}

export const costStore = {
  /**
   * Load and return all records. Seeds demo data on first use.
   */
  getRecords(): UsageRecord[] {
    const existing = _loadRecords();
    if (existing.length === 0) {
      // First use — seed realistic demo data
      const seed = generateSeedRecords(60);
      _saveRecords(seed);
      return seed;
    }
    return existing;
  },

  /**
   * Record a new API call. Persists to localStorage and notifies subscribers.
   */
  record(entry: Omit<UsageRecord, "id" | "ts" | "costUsd">): UsageRecord {
    const record: UsageRecord = {
      ...entry,
      id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: new Date().toISOString(),
      costUsd: calcCost(entry.model, entry.inputTokens, entry.outputTokens),
    };
    const existing = _loadRecords();
    _saveRecords([...existing, record]);
    _emit();
    return record;
  },

  /**
   * Delete all records (reset).
   */
  clear() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    _emit();
  },

  /**
   * Return an aggregated summary.
   */
  getSummary(): CostSummary {
    return aggregateRecords(this.getRecords());
  },

  subscribe(fn: () => void): () => void {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
  },
};
