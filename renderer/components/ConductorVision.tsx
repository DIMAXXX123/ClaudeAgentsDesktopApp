"use client";

import type { ConductorStatus } from "@/lib/useConductor";

const PILLAR_COLORS: Record<string, string> = {
  ultron: "#22e8ff",
  nova: "#22ff88",
  forge: "#ffae3a",
  ares: "#ff4adf",
  echo: "#06b6d4",
  midas: "#f5d64a",
};

export function ConductorVision({
  plan,
  glow,
}: {
  plan: NonNullable<ConductorStatus["plan"]>;
  glow: string;
}) {
  const current = plan.slots[plan.currentSlot];
  return (
    <div className="flex flex-col gap-2">
      <div
        className="rounded-sm border p-2 text-[10px] leading-snug"
        style={{ borderColor: `${glow}55`, color: `${glow}cc` }}
      >
        <div className="pixel text-[8px] tracking-[0.2em] opacity-70">VISION</div>
        <div className="mt-1 text-[10px] whitespace-pre-wrap">{plan.vision}</div>
      </div>
      {current && (
        <div className="flex flex-col gap-1">
          <div className="pixel text-[8px] tracking-[0.2em] opacity-70">CURRENT SLOT #{current.index} · {current.mode.toUpperCase()}</div>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(current.titles).map(([id, title]) => (
              <div
                key={id}
                className="rounded-sm border px-[6px] py-[4px] text-[9px] leading-tight"
                style={{
                  borderColor: `${PILLAR_COLORS[id] ?? glow}55`,
                  color: PILLAR_COLORS[id] ?? glow,
                }}
              >
                <div className="pixel text-[7px] tracking-[0.15em] opacity-80">{id.toUpperCase()}</div>
                <div className="text-[9px]">{title ?? "—"}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
