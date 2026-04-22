"use client";

import { useEffect, useMemo, useState } from "react";
import { AGENTS, type AgentSpec } from "@/lib/agents";
import { useProfileDB, profileStore, type AgentProfile } from "@/lib/profileStore";
import {
  levelFromCounters,
  rankFromLevel,
  nextRank,
  progressInLevel,
  xpValue,
  xpForLevel,
  unlockedMilestones,
} from "@/lib/rank";
import { loadChat } from "@/lib/chatStore";
import type { ChatMsg } from "@/lib/useAgentChat";

export function MemoryPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useProfileDB();
  const [query, setQuery] = useState("");
  const [focusAgent, setFocusAgent] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const agentList = Object.values(AGENTS);
  const profiles = agentList.map((a) => db.agents[a.id]).filter(Boolean) as AgentProfile[];

  const totals = profiles.reduce(
    (acc, p) => ({
      messages: acc.messages + p.messagesSent,
      tools: acc.tools + p.toolsUsed,
      sessions: acc.sessions + p.sessionCount,
      errors: acc.errors + p.errorsCount,
      duration: acc.duration + p.totalDurationMs,
    }),
    { messages: 0, tools: 0, sessions: 0, errors: 0, duration: 0 },
  );

  const favorite =
    profiles.length > 0
      ? [...profiles].sort((a, b) => b.messagesSent - a.messagesSent)[0]
      : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="neon-frame relative flex h-[92vh] w-[min(1200px,96vw)] flex-col overflow-hidden rounded-sm animate-slide-up"
        style={{ boxShadow: "0 0 40px rgba(34,232,255,0.35), inset 0 0 40px rgba(34,232,255,0.15)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neon-cyan/50 bg-gradient-to-r from-neon-cyan/10 to-transparent px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan shadow-neon-cyan">
              <span className="pixel text-sm">▥</span>
            </div>
            <div>
              <div className="pixel text-sm tracking-[0.3em] text-neon-cyan [text-shadow:_0_0_8px_#22e8ff]">
                MEMORY CORE
              </div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">
                Commander ledger · {Object.keys(db.agents).length}/{agentList.length} agents active
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (confirm("Wipe ALL agent memory? This cannot be undone.")) profileStore.forgetAll();
              }}
              className="rounded-sm border border-neon-red/60 bg-neon-red/10 px-2 py-1 text-[10px] uppercase text-neon-red hover:bg-neon-red/20"
            >
              WIPE ALL
            </button>
            <button
              onClick={onClose}
              className="rounded-sm border border-neon-cyan/60 px-3 py-1 text-[10px] uppercase text-neon-cyan hover:bg-neon-cyan/10"
            >
              CLOSE [ESC]
            </button>
          </div>
        </div>

        {/* Aggregate stats */}
        <div className="grid grid-cols-2 gap-2 border-b border-neon-cyan/20 px-4 py-3 md:grid-cols-5">
          <StatBox label="MESSAGES" value={totals.messages} tone="cyan" />
          <StatBox label="TOOL CALLS" value={totals.tools} tone="green" />
          <StatBox label="SESSIONS" value={totals.sessions} tone="purple" />
          <StatBox label="ERRORS" value={totals.errors} tone="red" />
          <StatBox
            label="FAVORITE"
            value={favorite ? AGENTS[favorite.agentId]?.name ?? favorite.agentId : "—"}
            tone="yellow"
          />
        </div>

        {/* Content scroll */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Agent cards */}
          <section>
            <SectionTitle>AGENT LEDGER</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {agentList.map((agent) => {
                const p = db.agents[agent.id] ?? null;
                return (
                  <AgentMemoryCard
                    key={agent.id}
                    agent={agent}
                    profile={p}
                    onFocus={() => setFocusAgent(focusAgent === agent.id ? null : agent.id)}
                    expanded={focusAgent === agent.id}
                    onForget={() => {
                      if (confirm(`Forget ${agent.name}? Stats reset to zero.`)) {
                        profileStore.forget(agent.id);
                      }
                    }}
                  />
                );
              })}
            </div>
          </section>

          {/* Heatmap */}
          <section>
            <SectionTitle>30-DAY ACTIVITY HEATMAP</SectionTitle>
            <Heatmap profiles={profiles} />
          </section>

          {/* Delegation graph */}
          <section>
            <SectionTitle>DELEGATION MATRIX (who → who)</SectionTitle>
            <DelegationMatrix profiles={profiles} />
          </section>

          {/* Timeline search */}
          <section>
            <SectionTitle>MEMORY TIMELINE SEARCH</SectionTitle>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search past chats (across all agents)…"
              className="w-full rounded-sm border border-white/20 bg-black/60 px-3 py-2 text-[12px] font-mono text-white placeholder:text-white/30 focus:border-neon-cyan/70 focus:outline-none"
            />
            {query.trim().length >= 2 && <TimelineSearch query={query} />}
          </section>

          <section>
            <SectionTitle>HOW THE MODEL WORKS</SectionTitle>
            <ModelExplanation />
          </section>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="pixel mb-2 text-[10px] tracking-[0.3em] text-neon-cyan/80">
      ◆ {children}
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: number | string; tone: string }) {
  const toneMap: Record<string, string> = {
    cyan: "border-neon-cyan/50 bg-neon-cyan/5 text-neon-cyan",
    green: "border-neon-green/50 bg-neon-green/5 text-neon-green",
    purple: "border-neon-purple/50 bg-neon-purple/5 text-neon-purple",
    red: "border-neon-red/50 bg-neon-red/5 text-neon-red",
    yellow: "border-neon-yellow/50 bg-neon-yellow/5 text-neon-yellow",
  };
  return (
    <div className={`rounded-sm border px-3 py-2 ${toneMap[tone] ?? toneMap.cyan}`}>
      <div className="pixel text-[9px] tracking-widest opacity-70">{label}</div>
      <div className="pixel text-lg">{value}</div>
    </div>
  );
}

function AgentMemoryCard({
  agent,
  profile,
  expanded,
  onFocus,
  onForget,
}: {
  agent: AgentSpec;
  profile: AgentProfile | null;
  expanded: boolean;
  onFocus: () => void;
  onForget: () => void;
}) {
  const msgs = profile?.messagesSent ?? 0;
  const tools = profile?.toolsUsed ?? 0;
  const xp = xpValue(msgs, tools);
  const level = levelFromCounters(msgs, tools);
  const rank = rankFromLevel(level);
  const next = nextRank(level);
  const prog = progressInLevel(xp, level);
  const topTools = Object.entries(profile?.toolCounts ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topKeywords = Object.entries(profile?.keywords ?? {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const milestones = unlockedMilestones(msgs);
  const lastSeen = profile?.lastSeenAt ? timeAgo(profile.lastSeenAt) : "never";
  const mins = profile ? Math.round(profile.totalDurationMs / 60000) : 0;

  return (
    <div
      className="rounded-sm border bg-black/40 p-3 transition hover:bg-black/60"
      style={{ borderColor: `${agent.color}66`, boxShadow: `inset 0 0 20px ${agent.color}11` }}
    >
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-sm border text-2xl"
          style={{ borderColor: agent.color, background: `${agent.color}20`, boxShadow: `0 0 12px ${agent.color}55` }}
        >
          {agent.emoji}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="pixel text-sm" style={{ color: agent.color, textShadow: `0 0 6px ${agent.color}` }}>
              {agent.name}
            </span>
            <span
              className="pixel rounded-sm border px-1.5 py-0.5 text-[8px] tracking-widest"
              style={{ borderColor: rank.color, color: rank.color, background: `${rank.color}15` }}
            >
              L{level} · {rank.label}
            </span>
          </div>
          <div className="truncate text-[10px] text-white/50">{rank.affinity}</div>
        </div>
        <button onClick={onForget} className="text-[9px] text-white/40 hover:text-neon-red" title="Forget this agent">
          ✕
        </button>
      </div>

      {/* XP bar */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[9px] uppercase tracking-widest text-white/50">
          <span>XP {xp}</span>
          <span>
            {next ? `${xpForLevel(level + 1) - xp} to L${level + 1}` : "MAX RANK"}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-sm border border-white/10 bg-black/60">
          <div
            className="h-full transition-all"
            style={{
              width: `${prog * 100}%`,
              background: `linear-gradient(90deg, ${agent.color}, ${rank.color})`,
              boxShadow: `0 0 8px ${agent.color}`,
            }}
          />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        <MiniStat label="MSG" value={msgs} color={agent.color} />
        <MiniStat label="TOOL" value={tools} color={agent.color} />
        <MiniStat label="SESS" value={profile?.sessionCount ?? 0} color={agent.color} />
        <MiniStat label="MIN" value={mins} color={agent.color} />
      </div>

      <div className="mt-2 flex justify-between text-[9px] text-white/40">
        <span>Last seen: {lastSeen}</span>
        <span>Errors: {profile?.errorsCount ?? 0}</span>
      </div>

      <button
        onClick={onFocus}
        className="mt-3 w-full rounded-sm border border-white/10 bg-white/5 py-1 text-[9px] uppercase tracking-widest text-white/60 hover:border-white/30 hover:text-white"
      >
        {expanded ? "− collapse" : "+ details"}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-white/10 pt-3">
          <div>
            <div className="pixel mb-1 text-[9px] text-white/40">TOP TOOLS</div>
            {topTools.length === 0 && <div className="text-[10px] text-white/30">— none yet —</div>}
            {topTools.map(([name, count]) => {
              const pct = Math.round((count / Math.max(1, tools)) * 100);
              return (
                <div key={name} className="mb-1 flex items-center gap-2 text-[10px]">
                  <span className="w-16 truncate text-white/70">{name}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-black/60">
                    <div className="h-full" style={{ width: `${pct}%`, background: agent.color }} />
                  </div>
                  <span className="w-8 text-right text-white/50">{count}</span>
                </div>
              );
            })}
          </div>
          <div>
            <div className="pixel mb-1 text-[9px] text-white/40">KEYWORD CLOUD</div>
            {topKeywords.length === 0 && <div className="text-[10px] text-white/30">— none yet —</div>}
            <div className="flex flex-wrap gap-1">
              {topKeywords.map(([w, c]) => (
                <span
                  key={w}
                  className="rounded-sm border px-1.5 py-0.5 text-[9px]"
                  style={{
                    borderColor: `${agent.color}55`,
                    background: `${agent.color}10`,
                    color: agent.color,
                    fontSize: `${Math.min(14, 9 + c)}px`,
                  }}
                >
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div>
            <div className="pixel mb-1 text-[9px] text-white/40">MILESTONES</div>
            <div className="flex flex-wrap gap-1">
              {milestones.length === 0 && <span className="text-[10px] text-white/30">— none yet —</span>}
              {milestones.map((m) => (
                <span
                  key={m.at}
                  className="pixel rounded-sm border border-neon-yellow/50 bg-neon-yellow/10 px-1.5 py-0.5 text-[9px] text-neon-yellow"
                >
                  ★ {m.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-sm border border-white/10 bg-black/40 px-1 py-1">
      <div className="pixel text-[8px] tracking-widest text-white/40">{label}</div>
      <div className="pixel text-sm" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Heatmap({ profiles }: { profiles: AgentProfile[] }) {
  const days = useMemo(() => {
    const arr: { key: string; count: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      let count = 0;
      for (const p of profiles) count += p.daily[key] ?? 0;
      arr.push({ key, count });
    }
    return arr;
  }, [profiles]);

  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="rounded-sm border border-white/10 bg-black/40 p-2">
      <div className="grid grid-cols-30 gap-1" style={{ gridTemplateColumns: "repeat(30, 1fr)" }}>
        {days.map((d) => {
          const intensity = d.count / max;
          return (
            <div
              key={d.key}
              title={`${d.key} — ${d.count} interactions`}
              className="aspect-square rounded-[1px] border border-white/5"
              style={{
                background:
                  d.count === 0
                    ? "rgba(255,255,255,0.04)"
                    : `rgba(34, 232, 255, ${0.15 + intensity * 0.85})`,
                boxShadow: d.count > 0 ? `0 0 ${2 + intensity * 6}px rgba(34,232,255,${intensity})` : undefined,
              }}
            />
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-[9px] uppercase text-white/40">
        <span>30 days ago</span>
        <span>today</span>
      </div>
    </div>
  );
}

function DelegationMatrix({ profiles }: { profiles: AgentProfile[] }) {
  const rows = profiles
    .filter((p) => Object.keys(p.delegationsOut).length > 0)
    .flatMap((p) =>
      Object.entries(p.delegationsOut).map(([target, count]) => ({
        from: p.agentId,
        to: target,
        count,
      })),
    )
    .sort((a, b) => b.count - a.count);

  if (rows.length === 0) {
    return (
      <div className="rounded-sm border border-white/10 bg-black/40 p-3 text-[11px] text-white/40">
        No agent-to-agent delegations recorded yet. Agents call each other via the Agent tool.
      </div>
    );
  }

  return (
    <div className="space-y-1 rounded-sm border border-white/10 bg-black/40 p-3">
      {rows.map((r, i) => {
        const from = AGENTS[r.from];
        const to = AGENTS[r.to];
        return (
          <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
            <span className="w-20" style={{ color: from?.color ?? "#fff" }}>
              {from?.name ?? r.from}
            </span>
            <span className="text-white/40">─────▶</span>
            <span className="w-20" style={{ color: to?.color ?? "#fff" }}>
              {to?.name ?? r.to}
            </span>
            <span className="ml-auto text-white/70">× {r.count}</span>
          </div>
        );
      })}
    </div>
  );
}

function TimelineSearch({ query }: { query: string }) {
  const q = query.toLowerCase();
  const results: { agentId: string; msg: ChatMsg; idx: number }[] = [];
  for (const agentId of Object.keys(AGENTS)) {
    const c = loadChat(agentId);
    c.messages.forEach((m, idx) => {
      if (m.text.toLowerCase().includes(q)) results.push({ agentId, msg: m, idx });
    });
  }

  if (results.length === 0) {
    return <div className="mt-2 text-[10px] text-white/40">No matches.</div>;
  }

  return (
    <div className="mt-2 max-h-64 space-y-1 overflow-y-auto rounded-sm border border-white/10 bg-black/40 p-2">
      {results.slice(0, 50).map((r, i) => {
        const agent = AGENTS[r.agentId];
        return (
          <div key={i} className="border-l-2 pl-2 text-[11px]" style={{ borderColor: agent?.color ?? "#fff" }}>
            <span className="pixel text-[9px] mr-2" style={{ color: agent?.color ?? "#fff" }}>
              {agent?.name ?? r.agentId} · {r.msg.role}
            </span>
            <span className="text-white/70">{r.msg.text.slice(0, 180)}</span>
          </div>
        );
      })}
      {results.length > 50 && (
        <div className="text-[9px] text-white/40">… {results.length - 50} more matches</div>
      )}
    </div>
  );
}

function ModelExplanation() {
  return (
    <div className="rounded-sm border border-neon-cyan/30 bg-black/40 p-3 text-[11px] leading-relaxed text-white/80">
      <p className="mb-2">
        <span className="pixel text-neon-cyan">BASE MODEL:</span> Claude Opus 4.7 via your Max
        subscription (OAuth — no API key). All 6 agents share one model; personality comes from the{" "}
        <em>system prompt</em>.
      </p>
      <p className="mb-2">
        <span className="pixel text-neon-cyan">MEMORY LAYERS:</span>
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          <strong>Identity</strong> — static <code>systemPrompt</code> (role + tools) in{" "}
          <code>lib/agents.ts</code>. Never changes.
        </li>
        <li>
          <strong>Session</strong> — Claude Agent SDK retains turn-by-turn history via{" "}
          <code>sessionId</code>; each send resumes it.
        </li>
        <li>
          <strong>Persistence</strong> — browser localStorage (<code>chatStore</code>) mirrors
          chats so reloads keep your history.
        </li>
        <li>
          <strong>Profile</strong> — this panel. Counts your interactions, tools, errors, keywords.
          Local only. Not sent to the model (yet).
        </li>
        <li>
          <strong>Delegation</strong> — any agent can invoke another via the{" "}
          <code>Agent</code> tool; SDK spawns a sub-query with the target agent&apos;s prompt.
        </li>
      </ul>
      <p className="mt-2 text-white/60">
        Level is <code>floor(sqrt(msg + tool*2))</code> — same math old-school RPGs used. Tiers are
        cosmetic; the model doesn&apos;t actually treat you differently yet — that&apos;s the next
        upgrade (mix profile into system prompt).
      </p>
    </div>
  );
}

function timeAgo(ts: number): string {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}
