"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import clsx from "clsx";
import { useConductor, useConductorJournal } from "@/lib/useConductor";
import { ConductorTimeline } from "./ConductorTimeline";
import { ConductorVision } from "./ConductorVision";
import { ConductorScoutFeed } from "./ConductorScoutFeed";
import { TerminalFrame } from "./TerminalFrame";

const GLOW = "#c084fc";

export function ConductorPanel() {
  const { data } = useConductor(6000);
  const journal = useConductorJournal(20_000);
  const [busy, setBusy] = useState<string | null>(null);
  const [last, setLast] = useState<string>("");

  const active = data?.active ?? false;
  const plan = data?.plan;

  async function doAction(label: string, url: string, init: RequestInit = {}) {
    setBusy(label);
    try {
      const r = await fetch(url, { method: "POST", ...init });
      const t = await r.text();
      setLast(`${label}: ${r.status} · ${t.slice(0, 140)}`);
    } catch (e) {
      setLast(`${label} ERROR: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <TerminalFrame
      accentColor={GLOW}
      className="h-full"
      header={
        <div className="flex items-center justify-between w-full">
          <div className="pixel text-[10px] tracking-[0.15em]">CONDUCTOR</div>
          <span
            className={clsx(
              "flex items-center gap-1 rounded-sm border px-1 py-[1px] text-[7px] uppercase tracking-widest",
              active && "animate-pulse",
            )}
            style={{ borderColor: `${GLOW}99`, color: GLOW }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: GLOW, boxShadow: `0 0 6px ${GLOW}` }}
            />
            {data?.aborted ? "ABORTED" : active ? "ACTIVE" : plan ? "IDLE" : "NO PLAN"}
          </span>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1">
        <CmdBtn
          label="🌙 PLAN"
          busy={busy}
          onClick={() => doAction("plan", "/api/conductor/plan")}
          disabled={!!plan}
        />
        <CmdBtn
          label="▶ TICK"
          busy={busy}
          onClick={() => doAction("tick", "/api/conductor/tick")}
          disabled={!plan || data?.aborted}
        />
        <CmdBtn
          label="🔍 SCOUT"
          busy={busy}
          onClick={() => doAction("scout-start", "/api/conductor/scout?action=start")}
          disabled={!plan || !!data?.scoutPid}
        />
        <CmdBtn
          label="⏹ SCOUT"
          busy={busy}
          onClick={() => doAction("scout-stop", "/api/conductor/scout?action=stop")}
          disabled={!data?.scoutPid}
        />
        <CmdBtn
          label="🛑 ABORT"
          busy={busy}
          onClick={() => doAction("abort", "/api/conductor/abort")}
          disabled={!plan}
          danger
        />
      </div>

      {data?.summary && (
        <div>
          {/* Progress bar */}
          <div className="mb-2 h-1.5 overflow-hidden rounded-sm border border-white/10 bg-black/40">
            <motion.div
              className="h-full"
              animate={{
                width: `${(data.summary.currentSlot / data.summary.slotCount) * 100}%`,
              }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                background: `linear-gradient(90deg, ${GLOW}, #c084fc)`,
                boxShadow: `0 0 8px ${GLOW}`,
              }}
            />
          </div>
          <div
            className="grid grid-cols-3 gap-1 rounded-sm border p-1 text-[9px] leading-tight bg-white/[0.02]"
            style={{ borderColor: `${GLOW}33` }}
          >
            <Stat label="slot" value={`${data.summary.currentSlot}/${data.summary.slotCount}`} />
            <Stat label="green" value={String(data.summary.greenSlots)} color="#22ff88" />
            <Stat label="red" value={String(data.summary.redSlots)} color="#ff3a5e" />
            <Stat label="pend" value={String(data.summary.pendingSlots)} color="#fbbf24" />
            <Stat label="streak" value={String(data.summary.redStreak)} color="#ff3a5e" />
            <Stat
              label="deg"
              value={data.summary.degraded ? "YES" : "no"}
              hot={data.summary.degraded}
              color={data.summary.degraded ? "#ff3a5e" : undefined}
            />
          </div>
        </div>
      )}

      {plan && <div><ConductorTimeline slots={plan.slots} currentSlot={plan.currentSlot} glow={GLOW} /></div>}

      {plan && <div><ConductorVision plan={plan} glow={GLOW} /></div>}

      {data?.scoutFeed && <div><ConductorScoutFeed feed={data.scoutFeed} glow={GLOW} /></div>}

      {data?.journalTail && data.journalTail.length > 0 && (
        <div
          className="flex max-h-32 flex-col gap-[2px] overflow-y-auto rounded-sm border p-1 text-[8px] leading-tight bg-white/[0.02]"
          style={{ borderColor: `${GLOW}33` }}
        >
          <div className="pixel text-[7px] tracking-[0.2em] opacity-70">JOURNAL</div>
          {data.journalTail.map((l, i) => (
            <div key={i} className="truncate opacity-80">
              {l}
            </div>
          ))}
        </div>
      )}

      {last && (
        <div className="text-[8px] opacity-70" style={{ color: `${GLOW}cc` }}>
          {last}
        </div>
      )}

      {journal && journal.length > 120 && (
        <details className="text-[8px] opacity-70">
          <summary className="cursor-pointer">Full journal ({journal.split("\n").length} lines)</summary>
          <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">{journal}</pre>
        </details>
      )}
        </div>
    </TerminalFrame>
  );
}

function CmdBtn({
  label,
  onClick,
  disabled,
  danger,
  busy,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  busy?: string | null;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy !== null}
      className={clsx(
        "rounded-sm border px-2 py-[2px] text-[8px] uppercase tracking-widest transition",
        disabled && "opacity-30",
        !disabled && "hover:brightness-125",
      )}
      style={{
        borderColor: danger ? "#ff3a5e99" : `${GLOW}99`,
        color: danger ? "#ff3a5e" : GLOW,
      }}
    >
      {busy ? `· ${busy}` : label}
    </button>
  );
}

function Stat({ label, value, hot, color }: { label: string; value: string; hot?: boolean; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="pixel text-[7px] tracking-[0.2em] opacity-60">{label}</span>
      <span
        className="text-[10px]"
        style={{ color: color || (hot ? "#ff3a5e" : undefined) }}
      >
        {value}
      </span>
    </div>
  );
}
