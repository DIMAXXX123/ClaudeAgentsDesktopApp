"use client";

/**
 * FilterChips — NOVA pillar (components/search/)
 *
 * Source-type filter chip strip for the NL-search panel.
 * Renders an "All" chip + one chip per type that has ≥1 result.
 * Supports multi-select (toggling individual type chips on/off).
 *
 * Usage:
 *   <FilterChips
 *     results={results}
 *     activeTypes={activeTypes}
 *     onToggle={(type) => setActiveTypes(toggleType(activeTypes, type))}
 *     onClear={() => setActiveTypes(new Set())}
 *   />
 */

import clsx from "clsx";
import type { SearchResult } from "@/lib/search/nlSearch";
import {
  activeChipTypes,
  countByType,
  FILTER_CHIP_LABELS,
} from "@/lib/search/filterChips";

// ── Chip colour map (matches SearchResults type-badge colours) ─────────────────

const CHIP_COLORS: Record<string, { base: string; active: string }> = {
  skill:          { base: "border-violet-800/50 text-violet-400 hover:bg-violet-900/30", active: "bg-violet-900/70 border-violet-600 text-violet-200" },
  agent:          { base: "border-cyan-800/50   text-cyan-400   hover:bg-cyan-900/30",   active: "bg-cyan-900/70   border-cyan-600   text-cyan-200" },
  hook:           { base: "border-amber-800/50  text-amber-400  hover:bg-amber-900/30",  active: "bg-amber-900/70  border-amber-600  text-amber-200" },
  rule:           { base: "border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/30", active: "bg-emerald-900/70 border-emerald-600 text-emerald-200" },
  plan:           { base: "border-blue-800/50   text-blue-400   hover:bg-blue-900/30",   active: "bg-blue-900/70   border-blue-600   text-blue-200" },
  command:        { base: "border-rose-800/50   text-rose-400   hover:bg-rose-900/30",   active: "bg-rose-900/70   border-rose-600   text-rose-200" },
  project:        { base: "border-indigo-800/50 text-indigo-400 hover:bg-indigo-900/30", active: "bg-indigo-900/70 border-indigo-600 text-indigo-200" },
  reference:      { base: "border-slate-600/50  text-slate-400  hover:bg-slate-700/30",  active: "bg-slate-700/70  border-slate-500  text-slate-200" },
  "output-style": { base: "border-pink-800/50   text-pink-400   hover:bg-pink-900/30",   active: "bg-pink-900/70   border-pink-600   text-pink-200" },
  "claude-md":    { base: "border-orange-800/50 text-orange-400 hover:bg-orange-900/30", active: "bg-orange-900/70 border-orange-600 text-orange-200" },
  "plugin-skill": { base: "border-violet-700/50 text-violet-300 hover:bg-violet-800/30", active: "bg-violet-800/70 border-violet-500 text-violet-100" },
  "plugin-command":{ base: "border-rose-700/50  text-rose-300   hover:bg-rose-800/30",   active: "bg-rose-800/70   border-rose-500   text-rose-100" },
  "plugin-agent": { base: "border-cyan-700/50   text-cyan-300   hover:bg-cyan-800/30",   active: "bg-cyan-800/70   border-cyan-500   text-cyan-100" },
  chat:           { base: "border-teal-800/50   text-teal-400   hover:bg-teal-900/30",   active: "bg-teal-900/70   border-teal-600   text-teal-200" },
};

const DEFAULT_CHIP = {
  base:   "border-white/10 text-white/40 hover:bg-white/5",
  active: "bg-white/10 border-white/25 text-white/70",
};

function chipColors(type: string, isActive: boolean) {
  const c = CHIP_COLORS[type] ?? DEFAULT_CHIP;
  return isActive ? c.active : c.base;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium",
        "transition-all duration-100 shrink-0 select-none",
        chipColors(label.toLowerCase(), active),
      )}
      aria-pressed={active}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span
          className={clsx(
            "inline-flex items-center justify-center min-w-[14px] h-[14px] px-0.5",
            "rounded-full text-[9px] font-mono tabular-nums",
            active ? "bg-white/20 text-white/80" : "bg-white/8 text-white/30",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function FilterChips({
  results,
  activeTypes,
  onToggle,
  onClear,
  className,
}: {
  /** Full (unfiltered) result list — used to count per type */
  results: SearchResult[];
  /** Set of currently active type filters */
  activeTypes: ReadonlySet<string>;
  /** Called when the user toggles a type chip */
  onToggle: (type: string) => void;
  /** Called when the user clicks "All" to clear all active filters */
  onClear: () => void;
  className?: string;
}) {
  const chips = activeChipTypes(results);
  const counts = countByType(results);
  const isAllActive = activeTypes.size === 0;

  // Don't render if there's nothing to filter (0 or 1 unique type)
  if (chips.length <= 1) return null;

  return (
    <div
      className={clsx(
        "flex items-center gap-1.5 flex-wrap",
        className,
      )}
      role="group"
      aria-label="Filter by source type"
    >
      {/* All chip */}
      <Chip
        label="All"
        count={results.length}
        active={isAllActive}
        onClick={onClear}
      />

      {/* Divider */}
      <span className="w-px h-3 bg-white/10 shrink-0" aria-hidden />

      {/* Per-type chips */}
      {chips.map((type) => (
        <Chip
          key={type}
          label={FILTER_CHIP_LABELS[type] ?? type}
          count={counts.get(type) ?? 0}
          active={activeTypes.has(type)}
          onClick={() => onToggle(type)}
        />
      ))}
    </div>
  );
}
