"use client";

import type { ConductorStatus } from "@/lib/useConductor";

const PILLAR_COLORS: Record<string, string> = {
  ultron: "#22e8ff",
  nova: "#22ff88",
  forge: "#ffae3a",
  ares: "#ff4adf",
  echo: "#06b6d4",
  midas: "#f5d64a",
  any: "#aaa",
};

export function ConductorScoutFeed({
  feed,
  glow,
}: {
  feed: NonNullable<ConductorStatus["scoutFeed"]>;
  glow: string;
}) {
  if (!feed.length) {
    return (
      <div
        className="rounded-sm border p-2 text-[9px]"
        style={{ borderColor: `${glow}33`, color: `${glow}99` }}
      >
        SCOUT: no ideas yet. Worker will post ~every 15 min.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="pixel text-[8px] tracking-[0.2em] opacity-70" style={{ color: glow }}>
        SCOUT FEED · {feed.length}
      </div>
      <div className="flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
        {feed
          .slice()
          .reverse()
          .map((i, idx) => (
            <div
              key={`${i.ts}-${idx}`}
              className="rounded-sm border px-[6px] py-[3px] text-[9px] leading-tight"
              style={{ borderColor: `${PILLAR_COLORS[i.pillar] ?? glow}55` }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="pixel text-[7px] tracking-[0.15em]"
                  style={{ color: PILLAR_COLORS[i.pillar] ?? glow }}
                >
                  {i.pillar.toUpperCase()}
                </span>
                <span className="text-[7px] opacity-60">rank {i.rank}</span>
              </div>
              <div className="text-[9px] opacity-90">{i.idea}</div>
              {i.sourceUrl && (
                <a
                  href={i.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block truncate text-[7px] opacity-60 hover:opacity-100"
                  style={{ color: `${PILLAR_COLORS[i.pillar] ?? glow}aa` }}
                >
                  {i.sourceUrl}
                </a>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
