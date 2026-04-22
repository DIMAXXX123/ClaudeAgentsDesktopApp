"use client";

import clsx from "clsx";
import type { ConductorStatus } from "@/lib/useConductor";

type Slot = NonNullable<ConductorStatus["plan"]>["slots"][number];

export function ConductorTimeline({
  slots,
  currentSlot,
  glow,
}: {
  slots: Slot[];
  currentSlot: number;
  glow: string;
}) {
  return (
    <div className="flex flex-wrap gap-[2px]" style={{ borderColor: glow }}>
      {slots.map((s) => (
        <SlotCell key={s.index} slot={s} active={s.index === currentSlot} />
      ))}
    </div>
  );
}

function SlotCell({ slot, active }: { slot: Slot; active: boolean }) {
  const color =
    slot.gate === "green"
      ? "#22ff88"
      : slot.gate === "red"
        ? "#ff3a5e"
        : slot.status === "running"
          ? "#22e8ff"
          : slot.status === "skipped"
            ? "#7a6a3a"
            : slot.status === "reverted"
              ? "#ff8f3a"
              : "#30384a";

  const tip = `#${slot.index} · ${slot.mode} · ${slot.status}${slot.gate ? " · " + slot.gate : ""}`;

  return (
    <div
      title={tip}
      className={clsx(
        "relative h-3 w-3 rounded-[1px] border",
        active && "animate-pulse",
      )}
      style={{
        background: color,
        borderColor: active ? "#fff" : `${color}99`,
        boxShadow: active ? "0 0 6px #fff" : undefined,
      }}
    />
  );
}
