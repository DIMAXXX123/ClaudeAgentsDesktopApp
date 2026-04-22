"use client";

import { AGENTS } from "@/lib/agents";
import { sfx } from "@/lib/sfx";

type Suggestion = {
  id: string;
  icon: string;
  title: string;
  body: string;
  agentId: keyof typeof AGENTS;
  prompt: string;
  tone: "cyan" | "green" | "magenta" | "orange" | "yellow" | "purple";
};

const SUGGESTIONS: Suggestion[] = [
  {
    id: "terminal",
    icon: "⌨️",
    title: "Open terminal",
    body: "ULTRON opens a Windows Terminal at the sandbox path.",
    agentId: "ultron",
    prompt: "Открой Windows Terminal в папке sandbox (start wt с cwd)",
    tone: "cyan",
  },
  {
    id: "scaffold",
    icon: "🏗️",
    title: "Scaffold a mini app",
    body: "FORGE creates a tiny Next.js + Tailwind app in sandbox and starts it.",
    agentId: "forge",
    prompt:
      "Создай в sandbox/mini-app маленький Next.js app с одной страницей 'Hello from FORGE', установи зависимости и запусти",
    tone: "orange",
  },
  {
    id: "repo-audit",
    icon: "🔍",
    title: "Audit a repo",
    body: "NOVA scans a directory for TODOs, FIXMEs and dead files.",
    agentId: "nova",
    prompt:
      "Просканируй C:\\Users\\Dimax\\Documents\\claude-workspace\\tiktok-clone\\ultronos-clone на все TODO/FIXME и потенциально неиспользуемые файлы. Дай короткий отчёт.",
    tone: "green",
  },
  {
    id: "api-probe",
    icon: "📡",
    title: "Probe an API",
    body: "ECHO hits an endpoint via curl and parses JSON.",
    agentId: "echo",
    prompt:
      "Сделай curl https://api.github.com/repos/NousResearch/hermes-agent и покажи name, stars, last push в читаемом виде",
    tone: "cyan",
  },
  {
    id: "fix-bug",
    icon: "🐛",
    title: "Hunt a bug",
    body: "ARES reproduces an error and patches it.",
    agentId: "ares",
    prompt:
      "Зайди в sandbox, запусти node -e 'JSON.parse(123.foo)' чтобы получить ошибку, объясни причину одним абзацем",
    tone: "magenta",
  },
  {
    id: "disk-usage",
    icon: "📊",
    title: "Disk usage report",
    body: "MIDAS measures top folders by size.",
    agentId: "midas",
    prompt:
      "Посчитай размер топ 10 папок в C:\\Users\\Dimax\\Documents (в МБ), отсортируй по убыванию, выведи таблицей",
    tone: "yellow",
  },
];

const TONE = {
  cyan: { border: "border-neon-cyan/60", glow: "hover:shadow-neon-cyan", text: "text-neon-cyan" },
  green: { border: "border-neon-green/60", glow: "hover:shadow-neon-green", text: "text-neon-green" },
  magenta: { border: "border-neon-magenta/60", glow: "hover:shadow-neon-magenta", text: "text-neon-magenta" },
  orange: { border: "border-neon-orange/60", glow: "", text: "text-neon-orange" },
  yellow: { border: "border-neon-yellow/60", glow: "", text: "text-neon-yellow" },
  purple: { border: "border-neon-purple/60", glow: "", text: "text-neon-purple" },
};

export function SuggestionsPanel({
  onRun,
}: {
  onRun: (agentId: string, prompt: string) => void;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between">
        <div>
          <div className="pixel text-sm uppercase tracking-widest text-neon-cyan">
            [SUGGESTIONS]
          </div>
          <div className="text-[11px] text-white/50">
            One-click tasks — click a card and an agent will take it.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((s) => {
          const agent = AGENTS[s.agentId];
          const tone = TONE[s.tone];
          return (
            <button
              key={s.id}
              onClick={() => {
                sfx.select();
                onRun(s.agentId, s.prompt);
              }}
              className={`group rounded-sm border bg-white/[0.03] p-3 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.06] ${tone.border} ${tone.glow}`}
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{s.icon}</span>
                <div className="flex-1">
                  <div className={`pixel text-[11px] tracking-widest ${tone.text}`}>
                    {s.title}
                  </div>
                  <div className="text-[9px] uppercase text-white/40">
                    via {agent.name} · {agent.room}
                  </div>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed text-white/70">{s.body}</p>
              <div className="mt-2 flex items-center gap-1 text-[10px] uppercase tracking-wider opacity-70 group-hover:opacity-100">
                <span className={tone.text}>RUN ►</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
