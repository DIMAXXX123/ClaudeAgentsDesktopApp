interface RoomTooltipProps {
  label: string | null;
  scenarioLabel?: string | null;
}

export function RoomTooltip({ label, scenarioLabel }: RoomTooltipProps) {
  if (!label && !scenarioLabel) {
    return null;
  }

  return (
    <div className="absolute top-2 left-2 pointer-events-none fade-in z-10">
      <div className="pixel px-1 py-0.5 text-xs bg-black/60 border border-white/40 text-white/90 leading-none">
        {scenarioLabel && <div className="text-[#22ff88] text-[6px]">{scenarioLabel}</div>}
        {label && !scenarioLabel && <div className="text-[6px]">{label}</div>}
      </div>
    </div>
  );
}
