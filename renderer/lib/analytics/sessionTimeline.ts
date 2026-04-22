/**
 * lib/analytics/sessionTimeline.ts
 *
 * Session timeline analytics — groups UsageRecords by sessionId, computes
 * per-agent token burn rate (tokens/min), and projects rolling 24-hour cost.
 *
 * Designed to feed the SessionTimeline component with zero external deps.
 */

import {
  MODEL_PRICING,
  calcCost,
  type ModelId,
  type UsageRecord,
} from "@/lib/analytics/costStore";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelinePoint {
  /** ISO timestamp bucket (minute-precision) */
  ts: string;
  /** cumulative tokens in this bucket */
  tokens: number;
  /** cost USD in this bucket */
  costUsd: number;
}

export interface AgentBurnRate {
  model: ModelId;
  label: string;
  color: string;
  /** tokens per minute over the session */
  tokensPerMin: number;
  /** cost per hour extrapolated */
  costPerHourUsd: number;
  /** total tokens in this session */
  totalTokens: number;
  /** total cost in this session */
  totalCostUsd: number;
  /** calls in this session */
  calls: number;
  /** mini sparkline: last N minute-buckets */
  sparkline: TimelinePoint[];
}

export interface SessionEntry {
  sessionId: string;
  label: string;
  /** ISO of first record in session */
  startedAt: string;
  /** ISO of last record in session */
  lastActiveAt: string;
  /** duration in minutes */
  durationMin: number;
  totalCostUsd: number;
  totalTokens: number;
  totalCalls: number;
  /** per-model breakdown */
  agents: AgentBurnRate[];
  /** aggregate cumulative cost sparkline (all agents combined) */
  cumulativeSparkline: TimelinePoint[];
}

export interface RollingProjection {
  /** burn rate ($/hr) over the last window */
  costPerHourUsd: number;
  /** projected spend over next 24 h */
  projected24hUsd: number;
  /** window used for projection (minutes) */
  windowMin: number;
}

export interface SessionTimelineData {
  sessions: SessionEntry[];
  projection: RollingProjection;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Round a Date down to the nearest minute bucket (returns ISO string) */
function toMinuteBucket(d: Date): string {
  return new Date(Math.floor(d.getTime() / 60_000) * 60_000).toISOString();
}

function fmtRelTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Build minute-bucket sparkline for a set of records, returning last `maxPoints` buckets */
function buildSparkline(
  records: UsageRecord[],
  maxPoints = 12,
): TimelinePoint[] {
  const map = new Map<string, TimelinePoint>();

  for (const r of records) {
    const bucket = toMinuteBucket(new Date(r.ts));
    const existing = map.get(bucket);
    const tokens = r.inputTokens + r.outputTokens;
    if (existing) {
      existing.tokens += tokens;
      existing.costUsd += r.costUsd;
    } else {
      map.set(bucket, { ts: bucket, tokens, costUsd: r.costUsd });
    }
  }

  const sorted = [...map.values()].sort((a, b) => a.ts.localeCompare(b.ts));
  return sorted.slice(-maxPoints);
}

/** Build cumulative sparkline — each point is the running sum up to that minute */
function buildCumulativeSparkline(
  records: UsageRecord[],
  maxPoints = 20,
): TimelinePoint[] {
  const raw = buildSparkline(records, maxPoints);
  let cum = 0;
  let cumTokens = 0;
  return raw.map((p) => {
    cum += p.costUsd;
    cumTokens += p.tokens;
    return { ts: p.ts, tokens: cumTokens, costUsd: cum };
  });
}

// ─── Core aggregation ─────────────────────────────────────────────────────────

/**
 * Group records into sessions and compute burn rates.
 * Records without a sessionId go into a synthetic "ad-hoc" session.
 */
export function buildSessionTimeline(
  records: UsageRecord[],
): SessionTimelineData {
  const sessionMap = new Map<string, UsageRecord[]>();

  for (const r of records) {
    const sid = r.sessionId ?? "__adhoc__";
    const bucket = sessionMap.get(sid) ?? [];
    bucket.push(r);
    sessionMap.set(sid, bucket);
  }

  const sessions: SessionEntry[] = [];

  for (const [sessionId, recs] of sessionMap.entries()) {
    const sorted = [...recs].sort((a, b) => a.ts.localeCompare(b.ts));
    const startedAt = sorted[0].ts;
    const lastActiveAt = sorted[sorted.length - 1].ts;
    const durationMin = Math.max(
      1,
      (new Date(lastActiveAt).getTime() - new Date(startedAt).getTime()) /
        60_000,
    );

    const totalCostUsd = recs.reduce((s, r) => s + r.costUsd, 0);
    const totalTokens = recs.reduce(
      (s, r) => s + r.inputTokens + r.outputTokens,
      0,
    );

    // Per-model breakdown
    const modelMap = new Map<ModelId, UsageRecord[]>();
    for (const r of recs) {
      const bucket = modelMap.get(r.model) ?? [];
      bucket.push(r);
      modelMap.set(r.model, bucket);
    }

    const agents: AgentBurnRate[] = [];
    for (const [model, mRecs] of modelMap.entries()) {
      const pricing = MODEL_PRICING[model];
      const mTokens = mRecs.reduce(
        (s, r) => s + r.inputTokens + r.outputTokens,
        0,
      );
      const mCost = mRecs.reduce((s, r) => s + r.costUsd, 0);
      const tokensPerMin = mTokens / durationMin;
      // Extrapolate cost/hr from token burn rate
      const tokensPerHour = tokensPerMin * 60;
      // Assume 80/20 input/output split for projection
      const costPerHourUsd = calcCost(
        model,
        tokensPerHour * 0.8,
        tokensPerHour * 0.2,
      );

      agents.push({
        model,
        label: pricing?.label ?? model,
        color: pricing?.color ?? "#888",
        tokensPerMin: Math.round(tokensPerMin * 10) / 10,
        costPerHourUsd,
        totalTokens: mTokens,
        totalCostUsd: mCost,
        calls: mRecs.length,
        sparkline: buildSparkline(mRecs, 10),
      });
    }

    agents.sort((a, b) => b.totalCostUsd - a.totalCostUsd);

    const label =
      recs[0].task ??
      (sessionId === "__adhoc__" ? "Ad-hoc" : `Session ${sessionId.slice(-4)}`);

    sessions.push({
      sessionId,
      label,
      startedAt,
      lastActiveAt,
      durationMin,
      totalCostUsd,
      totalTokens,
      totalCalls: recs.length,
      agents,
      cumulativeSparkline: buildCumulativeSparkline(sorted, 20),
    });
  }

  // Sort sessions newest-first
  sessions.sort((a, b) => b.lastActiveAt.localeCompare(a.lastActiveAt));

  // Rolling projection: use last 60 min of all records
  const projection = calcRollingProjection(records, 60);

  return {
    sessions,
    projection,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate rolling cost projection from recent records.
 * @param windowMin - look-back window in minutes
 */
export function calcRollingProjection(
  records: UsageRecord[],
  windowMin = 60,
): RollingProjection {
  const cutoff = Date.now() - windowMin * 60_000;
  const recent = records.filter((r) => new Date(r.ts).getTime() >= cutoff);

  if (recent.length === 0) {
    return { costPerHourUsd: 0, projected24hUsd: 0, windowMin };
  }

  const windowCost = recent.reduce((s, r) => s + r.costUsd, 0);
  const costPerHourUsd = (windowCost / windowMin) * 60;
  const projected24hUsd = costPerHourUsd * 24;

  return {
    costPerHourUsd: Math.round(costPerHourUsd * 10000) / 10000,
    projected24hUsd: Math.round(projected24hUsd * 10000) / 10000,
    windowMin,
  };
}

// ─── Seed helpers (for isolated demo of timeline) ────────────────────────────

const AGENT_TASKS = [
  "UEFN map refactor",
  "Telegram bot fix",
  "Next.js dashboard UI",
  "DB schema migration",
  "Cost dashboard impl",
  "Overnight agent loop",
  "Debug scout worker",
  "Theme system build",
  "PR review & merge",
  "Verse script update",
];

const MODELS: ModelId[] = [
  "claude-opus-4",
  "claude-sonnet-4",
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
];

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate seed session records for demo rendering.
 * Returns raw UsageRecord[] ready for buildSessionTimeline.
 */
export function generateTimelineSeedRecords(numSessions = 6): UsageRecord[] {
  const now = Date.now();
  const records: UsageRecord[] = [];

  for (let s = 0; s < numSessions; s++) {
    const sessionId = `sess-${String(s + 1).padStart(2, "0")}`;
    const task = AGENT_TASKS[s % AGENT_TASKS.length];
    // Sessions spread over last 48h, each 10-90 min long
    const sessionStart = now - randInt(0, 48 * 3600_000);
    const sessionDurMs = randInt(10, 90) * 60_000;
    const numCalls = randInt(4, 18);
    // 1-3 models per session
    const numModels = randInt(1, 3);
    const sessionModels = MODELS.slice(0, numModels);

    for (let c = 0; c < numCalls; c++) {
      const tsMs = sessionStart + (c / numCalls) * sessionDurMs;
      const model = sessionModels[c % sessionModels.length];
      const isLarge = Math.random() < 0.15;
      const inputTokens = isLarge ? randInt(8000, 40000) : randInt(400, 6000);
      const outputTokens = isLarge ? randInt(2000, 8000) : randInt(100, 1500);

      records.push({
        id: `seed-tl-${s}-${c}`,
        ts: new Date(tsMs).toISOString(),
        model,
        inputTokens,
        outputTokens,
        costUsd: calcCost(model, inputTokens, outputTokens),
        sessionId,
        task,
      });
    }
  }

  return records;
}

// ─── Re-export fmtRelTime for components ─────────────────────────────────────

export { fmtRelTime };
