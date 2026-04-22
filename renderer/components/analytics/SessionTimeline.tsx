"use client";

/**
 * components/analytics/SessionTimeline.tsx
 *
 * Session timeline panel with:
 * - Collapsible session rows ordered newest-first
 * - Per-agent token burn rate sparklines (SVG, no canvas)
 * - Rolling 24h cost projection badge
 * - Aggregate cumulative-cost sparkline per session
 * - Auto-refresh every 15s from /api/analytics/sessions
 */

import { useEffect, useState, useCallback, useId } from "react";
import type {
  SessionTimelineData,
  SessionEntry,
  AgentBurnRate,
  TimelinePoint,
  RollingProjection,
} from "@/lib/analytics/sessionTimeline";

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmtUsd(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(6)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDuration(mins: number): string {
  if (mins < 60) return `${Math.round(mins)}m`;
  return `${(mins / 60).toFixed(1)}h`;
}

function relTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Mini SVG sparkline ───────────────────────────────────────────────────────

interface SparkProps {
  points: TimelinePoint[];
  color: string;
  /** if true, use cumulative token values; else use per-bucket costUsd */
  useCost?: boolean;
  width?: number;
  height?: number;
}

function AgentSparkline({ points, color, useCost = false, width = 80, height = 24 }: SparkProps) {
  const uid = useId();
  const gradId = `spark-grad-${uid}`;

  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} aria-hidden>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeOpacity={0.2} strokeWidth={1} />
      </svg>
    );
  }

  const PAD = 2;
  const vals = points.map((p) => (useCost ? p.costUsd : p.tokens));
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals, minV + 0.000001);

  const pts = vals.map((v, i) => ({
    x: PAD + (i / (vals.length - 1)) * (width - PAD * 2),
    y: height - PAD - ((v - minV) / (maxV - minV)) * (height - PAD * 2),
  }));

  const linePath = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = pts[i - 1];
    const cpx = (prev.x + p.x) / 2;
    return `${d} C ${cpx} ${prev.y} ${cpx} ${p.y} ${p.x} ${p.y}`;
  }, "");

  const last = pts[pts.length - 1];
  const first = pts[0];
  const areaPath = `${linePath} L ${last.x} ${height - PAD} L ${first.x} ${height - PAD} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      {/* endpoint dot */}
      <circle cx={last.x} cy={last.y} r={2} fill={color} />
    </svg>
  );
}

// ─── Projection badge ─────────────────────────────────────────────────────────

function ProjectionBadge({ projection }: { projection: RollingProjection }) {
  const isHot = projection.projected24hUsd > 1;
  return (
    <div
      className={[
        "flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-mono",
        isHot ? "bg-orange-500/15 text-orange-300" : "bg-white/5 text-white/60",
      ].join(" ")}
      title={`Based on last ${projection.windowMin}min burn rate`}
    >
      <span className="opacity-60">↗ proj 24h</span>
      <span className="font-bold tabular-nums">{fmtUsd(projection.projected24hUsd)}</span>
      <span className="opacity-40">·</span>
      <span className="opacity-60">{fmtUsd(projection.costPerHourUsd)}/hr</span>
    </div>
  );
}

// ─── Agent burn row ───────────────────────────────────────────────────────────

function AgentBurnRow({ agent }: { agent: AgentBurnRate }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      {/* color dot + label */}
      <div className="flex items-center gap-1 w-[90px] flex-shrink-0">
        <span
          className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: agent.color }}
        />
        <span className="text-[10px] truncate opacity-75">{agent.label}</span>
      </div>

      {/* sparkline */}
      <div className="flex-shrink-0">
        <AgentSparkline points={agent.sparkline} color={agent.color} />
      </div>

      {/* burn rate */}
      <div className="ml-auto flex items-center gap-2 text-[10px] font-mono tabular-nums flex-shrink-0">
        <span className="opacity-40">{fmtTokens(agent.totalTokens)} tok</span>
        <span className="opacity-60">{agent.tokensPerMin}/min</span>
        <span className="font-bold">{fmtUsd(agent.totalCostUsd)}</span>
      </div>
    </div>
  );
}

// ─── Session row ──────────────────────────────────────────────────────────────

function SessionRow({ session }: { session: SessionEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded bg-white/5 border border-white/5 overflow-hidden">
      {/* summary row */}
      <button
        className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-white/5 transition-colors text-left"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {/* expand chevron */}
        <span className={["text-[10px] opacity-40 transition-transform", expanded ? "rotate-90" : ""].join(" ")}>
          ▶
        </span>

        {/* session label */}
        <span className="text-[11px] font-mono font-medium flex-1 truncate">{session.label}</span>

        {/* cumulative sparkline */}
        <AgentSparkline
          points={session.cumulativeSparkline}
          color="#38bdf8"
          useCost
          width={60}
          height={20}
        />

        {/* meta */}
        <div className="flex items-center gap-2 text-[10px] font-mono tabular-nums flex-shrink-0">
          <span className="opacity-40">{relTime(session.lastActiveAt)}</span>
          <span className="opacity-40">{fmtDuration(session.durationMin)}</span>
          <span className="opacity-60">{session.totalCalls}×</span>
          <span className="font-bold text-[var(--ut-accent,#38bdf8)]">{fmtUsd(session.totalCostUsd)}</span>
        </div>
      </button>

      {/* expanded detail */}
      {expanded && (
        <div className="px-3 pb-2.5 pt-1 border-t border-white/5">
          {/* agent burn rates */}
          <div className="text-[9px] uppercase tracking-widest opacity-30 mb-1.5">
            Agent burn rates
          </div>
          <div className="flex flex-col gap-0.5">
            {session.agents.map((agent) => (
              <AgentBurnRow key={agent.model} agent={agent} />
            ))}
          </div>

          {/* session meta footer */}
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/5 text-[9px] font-mono opacity-40">
            <span>start: {new Date(session.startedAt).toLocaleTimeString()}</span>
            <span>end: {new Date(session.lastActiveAt).toLocaleTimeString()}</span>
            <span className="ml-auto">
              {fmtTokens(session.totalTokens)} total tokens
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main SessionTimeline component ──────────────────────────────────────────

interface FetchedData extends SessionTimelineData {
  ok: boolean;
  hours: number;
  windowMin: number;
}

type HourRange = 6 | 24 | 48 | 168;

export function SessionTimeline() {
  const [data, setData] = useState<FetchedData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hours, setHours] = useState<HourRange>(48);
  const [lastUpdated, setLastUpdated] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/analytics/sessions?hours=${hours}&window=60`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as FetchedData;
      setData(json);
      setLastUpdated(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fetch error");
    }
  }, [hours]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 15_000);
    return () => clearInterval(timer);
  }, [load]);

  const HOUR_RANGES: HourRange[] = [6, 24, 48, 168];
  const RANGE_LABELS: Record<HourRange, string> = { 6: "6h", 24: "24h", 48: "48h", 168: "7d" };

  if (error) {
    return (
      <div className="neon-frame rounded-lg p-4 text-[11px] font-mono text-red-400 opacity-80">
        ⚠ Session timeline: {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="neon-frame rounded-lg p-4 text-xs font-mono opacity-50">
        Loading session timeline…
      </div>
    );
  }

  return (
    <div className="neon-frame rounded-lg p-3 flex flex-col gap-3 font-mono select-none">
      {/* ── Header ── */}
      <div className="flex items-center gap-2 border-b border-[var(--ut-border)] pb-2">
        <span className="text-xs tracking-widest uppercase opacity-50">
          ⏱ Session Timeline
        </span>
        <div className="ml-auto flex items-center gap-1">
          {HOUR_RANGES.map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={[
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                hours === h
                  ? "bg-[var(--ut-accent,#38bdf8)] text-black"
                  : "opacity-40 hover:opacity-70",
              ].join(" ")}
            >
              {RANGE_LABELS[h]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Rolling projection ── */}
      <div className="flex items-center gap-2">
        <ProjectionBadge projection={data.projection} />
        <span className="text-[9px] opacity-30 ml-auto tabular-nums">↻ {lastUpdated}</span>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
        {[
          { label: "Sessions", value: String(data.sessions.length) },
          {
            label: "Total calls",
            value: String(data.sessions.reduce((s, sess) => s + sess.totalCalls, 0)),
          },
          {
            label: "Total cost",
            value: fmtUsd(data.sessions.reduce((s, sess) => s + sess.totalCostUsd, 0)),
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded bg-white/5 px-2 py-1 flex flex-col gap-0.5">
            <span className="text-[9px] uppercase tracking-widest opacity-30">{label}</span>
            <span className="font-bold tabular-nums">{value}</span>
          </div>
        ))}
      </div>

      {/* ── Session list ── */}
      {data.sessions.length === 0 ? (
        <div className="text-[11px] opacity-40 text-center py-3">
          No sessions in this window
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-0.5">
          {data.sessions.map((session) => (
            <SessionRow key={session.sessionId} session={session} />
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div className="text-[9px] opacity-25 border-t border-[var(--ut-border)] pt-1.5">
        {data.sessions.length} session{data.sessions.length !== 1 ? "s" : ""} · last {hours}h
      </div>
    </div>
  );
}
