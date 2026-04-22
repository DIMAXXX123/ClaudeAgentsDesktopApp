"use client";

import clsx from "clsx";
import { useEffect, useRef } from "react";
import { useListenerHealth, type ListenerHealth } from "@/lib/useListenerHealth";
import { useTgFeed, type TgFeedEntry } from "@/lib/useTgFeed";
import { TerminalFrame } from "./TerminalFrame";

/** TG listener vigil — sidebar column, not an overlay.
 *  Top: pixel character with headphones (alive/dead by TG server state).
 *  Bottom: mini-chat showing last in/out messages from simple_bot.py. */
export function ListenerPanel() {
  const health = useListenerHealth(5000);
  const feed = useTgFeed(3000, 30);
  const alive = health.alive;
  const glow = alive ? "#22ff88" : "#ff3a5e";

  return (
    <TerminalFrame
      accentColor={glow}
      header={
        <div className="flex items-center justify-between w-full">
          <div className="pixel text-[10px] tracking-[0.15em]">LISTENER</div>
          <span
            className={clsx(
              "flex items-center gap-1 rounded-sm border px-1 py-[1px] text-[7px] uppercase tracking-widest",
              alive && "animate-pulse",
            )}
            style={{ borderColor: `${glow}99`, color: glow }}
          >
            <span
              className="h-1 w-1 rounded-full"
              style={{ background: glow, boxShadow: `0 0 6px ${glow}` }}
            />
            {alive ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      }
      className="h-full"
    >
      <div className="flex flex-col gap-3 p-3">
        <ListenerPortrait alive={alive} glow={glow} />
        <HealthRows health={health} />
        <ContextBlock health={health} glow={glow} />
        <MiniChat feed={feed} alive={alive} glow={glow} />
      </div>
    </TerminalFrame>
  );
}

function ListenerPortrait({ alive, glow }: { alive: boolean; glow: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-[3px] border-2"
      style={{
        aspectRatio: "5 / 5",
        borderColor: glow,
        background: "#1a1424",
        boxShadow: `inset 0 0 14px ${glow}22, 0 0 0 1px #000`,
        filter: alive ? undefined : "grayscale(0.75) brightness(0.75)",
      }}
    >
      <svg
        viewBox="0 0 80 80"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      >
        <rect x="0" y="0" width="80" height="50" fill="#2a1f38" />
        <rect x="0" y="0" width="80" height="3" fill="#1a1424" />
        <rect x="0" y="48" width="80" height="2" fill="#4a3a60" />
        <rect x="0" y="50" width="80" height="30" fill="#3a2e48" />
        <rect x="0" y="50" width="80" height="2" fill="#5a4a70" />

        {alive && <ellipse cx="40" cy="22" rx="28" ry="14" fill={glow} opacity="0.15" />}

        {/* desk + radio */}
        <rect x="8" y="56" width="64" height="3" fill="#6a4a1a" />
        <rect x="8" y="59" width="64" height="18" fill="#4a3216" />
        <rect x="14" y="46" width="18" height="10" fill="#2a2238" />
        <rect x="14" y="46" width="18" height="2" fill="#4a4260" />
        <circle cx="18" cy="52" r="1.6" fill={alive ? glow : "#6a5a6a"} />
        <circle cx="24" cy="52" r="1.6" fill={alive ? "#ffae3a" : "#6a5a6a"} />
        <rect x="50" y="48" width="3" height="3" fill="#4a4260" />
        <rect x="51" y="51" width="1" height="5" fill="#2a2238" />
        <rect x="48" y="56" width="7" height="1" fill="#1a1424" />
        <rect x="36" y="38" width="12" height="10" fill="#1a1424" />
        <rect x="37" y="39" width="10" height="7" fill={alive ? "#0a1a28" : "#2a2030"} />
        {alive && (
          <>
            <rect x="38" y="40" width="6" height="0.5" fill={glow} opacity="0.9" />
            <rect x="38" y="42" width="4" height="0.5" fill={glow} opacity="0.7" />
            <rect x="38" y="44" width="7" height="0.5" fill={glow} opacity="0.9" />
          </>
        )}

        <g
          className={alive ? "animate-listener-breathe" : undefined}
          style={{ transformOrigin: "40px 40px" }}
        >
          <rect x="30" y="30" width="20" height="26" fill="#2a2238" opacity="0.9" />
          <rect
            x={alive ? 30 : 29}
            y={alive ? 30 : 32}
            width="20"
            height={alive ? 24 : 22}
            fill="#3a5a8a"
          />
          <rect
            x={alive ? 30 : 29}
            y={alive ? 30 : 32}
            width="20"
            height="2"
            fill="#5a7aaa"
          />
          <rect x={alive ? 37 : 36} y={alive ? 24 : 28} width="6" height="3" fill="#f3c79a" />
          <g className={alive ? "animate-head-nod" : undefined} style={{ transformOrigin: "40px 20px" }}>
            <rect x={alive ? 34 : 33} y={alive ? 12 : 16} width="12" height="14" fill="#f3c79a" />
            <rect x={alive ? 34 : 33} y={alive ? 12 : 16} width="12" height="4" fill="#3a2414" />
            <rect x={alive ? 33 : 32} y={alive ? 14 : 18} width="1" height="3" fill="#3a2414" />
            <rect x={alive ? 46 : 45} y={alive ? 14 : 18} width="1" height="3" fill="#3a2414" />
            {alive && (
              <>
                <rect x="35" y="17" width="3" height="0.6" fill="#1a1014" />
                <rect x="42" y="17" width="3" height="0.6" fill="#1a1014" />
              </>
            )}
            {alive ? (
              <g className="animate-blink">
                <rect x="36" y="19" width="1.5" height="1.5" fill="#1a0e14" />
                <rect x="42.5" y="19" width="1.5" height="1.5" fill="#1a0e14" />
                <rect x="36" y="19" width="0.6" height="0.6" fill="#fff" />
                <rect x="42.5" y="19" width="0.6" height="0.6" fill="#fff" />
              </g>
            ) : (
              <g>
                <rect x="35" y="22" width="3" height="0.6" fill="#1a0e14" transform="rotate(45 36.5 22.3)" />
                <rect x="35" y="22" width="3" height="0.6" fill="#1a0e14" transform="rotate(-45 36.5 22.3)" />
                <rect x="42" y="22" width="3" height="0.6" fill="#1a0e14" transform="rotate(45 43.5 22.3)" />
                <rect x="42" y="22" width="3" height="0.6" fill="#1a0e14" transform="rotate(-45 43.5 22.3)" />
              </g>
            )}
            {alive ? (
              <rect x="38" y="23" width="4" height="0.8" fill="#6b3a20" />
            ) : (
              <path d="M 37 24 Q 40 22 43 24" stroke="#6b3a20" strokeWidth="0.6" fill="none" />
            )}
            <rect x={alive ? 34 : 33} y={alive ? 10 : 14} width="12" height="1.5" fill="#1a1014" />
            <rect x={alive ? 34 : 33} y={alive ? 10 : 14} width="12" height="0.6" fill={glow} />
            <rect x={alive ? 32 : 31} y={alive ? 14 : 18} width="3" height="5" fill="#2a2238" />
            <rect x={alive ? 32 : 31} y={alive ? 14 : 18} width="3" height="1" fill={glow} opacity={alive ? 1 : 0.3} />
            <rect x={alive ? 45 : 44} y={alive ? 14 : 18} width="3" height="5" fill="#2a2238" />
            <rect x={alive ? 45 : 44} y={alive ? 14 : 18} width="3" height="1" fill={glow} opacity={alive ? 1 : 0.3} />
            {alive && (
              <>
                <rect x="46" y="19" width="0.8" height="4" fill="#2a2238" transform="rotate(30 46 19)" />
                <rect x="48" y="22" width="2" height="2" fill="#2a2238" />
              </>
            )}
          </g>
          <g className={alive ? "animate-arm-type" : undefined}>
            <rect x="30" y="48" width="5" height="6" fill="#3a5a8a" />
            <rect x="33" y="54" width="5" height="2" fill="#f3c79a" />
          </g>
          <g className={alive ? "animate-arm-type" : undefined} style={{ animationDelay: "0.1s" }}>
            <rect x="46" y="48" width="5" height="6" fill="#3a5a8a" />
            <rect x="43" y="54" width="5" height="2" fill="#f3c79a" />
          </g>
        </g>

        {alive && (
          <>
            <circle cx="34" cy="16" r="4" fill="none" stroke={glow} strokeWidth="0.5" className="animate-wave-pulse" />
            <circle cx="46" cy="16" r="4" fill="none" stroke={glow} strokeWidth="0.5" className="animate-wave-pulse" style={{ animationDelay: "0.6s" }} />
          </>
        )}

        {!alive && (
          <g>
            <text x="52" y="10" fontSize="5" fill="#ff3a5e" fontFamily="monospace" fontWeight="bold">✕</text>
            <text x="60" y="8" fontSize="3" fill="#6a5a6a" fontFamily="monospace">RIP</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function HealthRows({ health }: { health: ListenerHealth }) {
  return (
    <div className="flex flex-col gap-1 text-[8px] uppercase tracking-wider">
      <Row
        label={
          health.proc?.pid
            ? `simple_bot.py · pid ${health.proc.pid}`
            : "simple_bot.py"
        }
        ok={health.simpleBot}
      />
      <div className="mt-0.5 text-[7px] tracking-wider text-white/40">
        {health.checkedAt
          ? `last ${new Date(health.checkedAt).toLocaleTimeString()}`
          : "pinging…"}
      </div>
      {health.error && (
        <div className="text-[7px] text-neon-red/80">{health.error.slice(0, 60)}</div>
      )}
    </div>
  );
}

function ContextBlock({ health, glow }: { health: ListenerHealth; glow: string }) {
  const primarySession = health.sessions[0];
  const cwdShort = health.cwd.replace(/^C:\\Users\\Dimax/i, "~");
  return (
    <div
      className="flex flex-col gap-0.5 rounded-sm border px-1.5 py-1 font-mono text-[8px] leading-snug"
      style={{ borderColor: `${glow}33`, background: "#0a0612" }}
    >
      <div className="flex items-center justify-between pixel text-[8px] tracking-[0.15em] text-white/60">
        <span>CONTEXT</span>
        <span className="text-white/30">{health.botUsername}</span>
      </div>
      <CtxRow k="cwd" v={cwdShort || "—"} glow={glow} />
      <CtxRow
        k="session"
        v={primarySession ? `${primarySession.sessionId.slice(0, 8)}…` : "—"}
        glow={glow}
      />
      <CtxRow
        k="users"
        v={
          health.allowedUsers.length
            ? health.allowedUsers.map((u) => String(u)).join(", ")
            : "—"
        }
        glow={glow}
      />
      {health.lastLogLine && (
        <div className="mt-1 truncate text-[7px] text-white/50" title={health.lastLogLine}>
          ▸ {health.lastLogLine.replace(/^\d{4}-\d{2}-\d{2} /, "")}
        </div>
      )}
    </div>
  );
}

function CtxRow({ k, v, glow }: { k: string; v: string; glow: string }) {
  return (
    <div className="flex items-center gap-1 text-[8px]">
      <span className="shrink-0 uppercase tracking-wider text-white/35">{k}</span>
      <span className="flex-1 truncate" style={{ color: glow }} title={v}>
        {v}
      </span>
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/55">{label}</span>
      <span
        className="flex items-center gap-1"
        style={{ color: ok ? "#22ff88" : "#ff3a5e" }}
      >
        <span
          className="h-1 w-1 rounded-full"
          style={{
            background: ok ? "#22ff88" : "#ff3a5e",
            boxShadow: `0 0 4px ${ok ? "#22ff88" : "#ff3a5e"}`,
          }}
        />
        {ok ? "up" : "down"}
      </span>
    </div>
  );
}

function MiniChat({
  feed,
  alive,
  glow,
}: {
  feed: TgFeedEntry[];
  alive: boolean;
  glow: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastLenRef = useRef(0);

  useEffect(() => {
    if (feed.length !== lastLenRef.current) {
      lastLenRef.current = feed.length;
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [feed]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      <div className="flex items-center justify-between pixel text-[8px] tracking-[0.15em] text-white/60">
        <span>TG CHAT</span>
        <span className="text-white/30">@OpenClawDimaxbot</span>
      </div>
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto rounded-sm border p-1.5 font-mono text-[9px] leading-snug"
        style={{
          borderColor: `${glow}55`,
          background: "#0a0612",
          minHeight: 120,
        }}
      >
        {feed.length === 0 ? (
          <div className="text-white/30">
            {alive ? "Ожидание сообщений…" : "Сервер офлайн — лог недоступен"}
          </div>
        ) : (
          feed.map((m) => (
            <div
              key={`${m.t}-${m.dir}`}
              className={clsx(
                "mb-1 flex flex-col rounded-sm px-1.5 py-1",
                m.dir === "in" ? "items-start" : "items-end",
              )}
              style={{
                background: m.dir === "in" ? `${glow}14` : "#1e1630",
                border: `1px solid ${m.dir === "in" ? `${glow}33` : "#3a2e58"}`,
                alignSelf: m.dir === "in" ? "flex-start" : "flex-end",
                maxWidth: "94%",
              }}
            >
              <div className="mb-0.5 flex items-center gap-1 text-[7px] uppercase tracking-widest text-white/40">
                <span>{m.dir === "in" ? `← ${m.name || "user"}` : "→ bot"}</span>
                <span className="text-white/25">
                  {new Date(m.t).toLocaleTimeString(undefined, {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              <div className="whitespace-pre-wrap break-words text-white/85">
                {m.text.length > 280 ? m.text.slice(0, 280) + "…" : m.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
