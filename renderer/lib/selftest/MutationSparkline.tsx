"use client";

/**
 * lib/selftest/MutationSparkline.tsx
 *
 * Pure-SVG sparkline chart that visualises mutation score deltas per commit.
 * Each bar represents one commit; its height encodes |delta|; colour encodes
 * direction (green = improved, red = regressed, neutral grey = no prior data).
 *
 * No external charting dependency — plain SVG + Tailwind classes.
 *
 * Usage:
 *   <MutationSparkline deltas={computeScoreDeltas()} />
 */

import type { MutationDelta } from "./mutationScore";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MutationSparklineProps = {
  deltas: MutationDelta[];
  /**
   * Width of the SVG viewport (px).  Height is derived as width / 4.
   * Defaults to 320.
   */
  width?: number;
  /** Show commit SHA labels on x-axis. Defaults to false (too dense). */
  showLabels?: boolean;
  /** Accessible title injected into the SVG <title>. */
  title?: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BAR_GAP = 2; // px between bars
const Y_PAD = 4;   // vertical padding inside the SVG

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Maps an absolute delta value to a bar height in [minPx, maxPx].
 */
function deltaToHeight(
  absDelta: number,
  maxDelta: number,
  maxPx: number,
  minPx = 4,
): number {
  if (maxDelta === 0) return minPx;
  return minPx + ((absDelta / maxDelta) * (maxPx - minPx));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MutationSparkline({
  deltas,
  width = 320,
  showLabels = false,
  title = "Mutation score Δ per commit",
}: MutationSparklineProps) {
  if (deltas.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs text-zinc-500"
        style={{ width, height: Math.round(width / 4) }}
      >
        No mutation data yet
      </div>
    );
  }

  const svgHeight = Math.round(width / 4);
  const chartH = svgHeight - Y_PAD * 2;
  const n = deltas.length;
  const barW = Math.max(2, (width - BAR_GAP * (n + 1)) / n);

  // The first entry has delta=null; treat as 0 for scale computation
  const absoluteDeltas = deltas.map((d) => Math.abs(d.delta ?? 0));
  const maxAbsDelta = Math.max(...absoluteDeltas, 0.001); // guard /0

  // Baseline y (centre line for neutral bar rendering)
  const baselineY = Y_PAD + chartH / 2;

  return (
    <div className="relative inline-block" style={{ width }}>
      {/* Baseline label */}
      <div className="flex justify-between mb-0.5 px-0.5">
        <span className="text-[10px] text-zinc-500">{title}</span>
        <span className="text-[10px] font-mono text-zinc-400">
          ±{maxAbsDelta.toFixed(1)} max
        </span>
      </div>

      <svg
        width={width}
        height={svgHeight}
        viewBox={`0 0 ${width} ${svgHeight}`}
        aria-label={title}
        role="img"
        className="block"
      >
        <title>{title}</title>

        {/* Baseline rule */}
        <line
          x1={0}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#3f3f46" /* zinc-700 */
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />

        {deltas.map((d, i) => {
          const x = BAR_GAP + i * (barW + BAR_GAP);
          const absDelta = Math.abs(d.delta ?? 0);
          const barH = deltaToHeight(absDelta, maxAbsDelta, chartH / 2 - Y_PAD);

          const isFirst = d.delta === null;
          const isPositive = (d.delta ?? 0) > 0;
          const isNegative = (d.delta ?? 0) < 0;

          // Positive bars grow upward; negative grow downward from baseline
          const y = isNegative ? baselineY : baselineY - barH;
          const fill = isFirst
            ? "#52525b" /* zinc-600 */
            : isPositive
              ? "#22c55e" /* green-500 */
              : isNegative
                ? "#ef4444" /* red-500 */
                : "#71717a" /* zinc-500 (zero delta) */;

          // Score score circle at bar tip
          const tipY = isNegative ? y + barH : y;

          return (
            <g key={`${d.commitSha}-${i}`}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 1)}
                fill={fill}
                rx={1}
                opacity={0.85}
              >
                <title>
                  {d.commitSha} | score: {d.score.toFixed(1)}%
                  {d.delta !== null
                    ? ` | Δ ${d.delta > 0 ? "+" : ""}${d.delta.toFixed(2)}`
                    : " | (baseline)"}
                </title>
              </rect>

              {/* Score dot at tip for emphasis */}
              <circle
                cx={x + barW / 2}
                cy={tipY}
                r={Math.min(barW / 2, 2.5)}
                fill={fill}
                opacity={0.5}
              />

              {showLabels && (
                <text
                  x={x + barW / 2}
                  y={svgHeight - 1}
                  fontSize={6}
                  fill="#71717a"
                  textAnchor="middle"
                >
                  {d.commitSha.slice(0, 5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Footer summary row */}
      <SparklineSummaryRow deltas={deltas} />
    </div>
  );
}

// ─── Summary footer ───────────────────────────────────────────────────────────

function SparklineSummaryRow({ deltas }: { deltas: MutationDelta[] }) {
  const latest = deltas[deltas.length - 1];
  const nonNull = deltas.filter((d) => d.delta !== null);
  const improvedCount = nonNull.filter((d) => (d.delta ?? 0) > 0).length;
  const regressedCount = nonNull.filter((d) => (d.delta ?? 0) < 0).length;

  const latestDeltaStr =
    latest.delta === null
      ? "baseline"
      : `${latest.delta > 0 ? "+" : ""}${latest.delta.toFixed(2)}`;

  return (
    <div className="flex items-center gap-3 mt-1 text-[10px] font-mono">
      <span className="text-zinc-300">
        score: <strong>{latest.score.toFixed(1)}%</strong>
      </span>
      <span
        className={
          latest.delta === null
            ? "text-zinc-500"
            : latest.delta > 0
              ? "text-green-400"
              : latest.delta < 0
                ? "text-red-400"
                : "text-zinc-400"
        }
      >
        Δ {latestDeltaStr}
      </span>
      <span className="text-zinc-500 ml-auto">
        ↑{improvedCount} ↓{regressedCount}
      </span>
    </div>
  );
}
