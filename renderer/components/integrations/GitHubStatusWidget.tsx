/**
 * GitHubStatusWidget — live public-repo status panel for ULTRONOS.
 *
 * Shows: stars · forks · open issues · language · last push · latest commit.
 * Polls /api/integrations/github every 60s.
 * Usage:
 *   <GitHubStatusWidget repo="vercel/next.js" />
 *   <GitHubStatusWidget repo="https://github.com/facebook/react" />
 */
"use client";

import { useState } from "react";
import clsx from "clsx";
import { useGitHubStatus } from "@/lib/integrations/useGitHubStatus";
import { formatStaleness } from "@/lib/integrations/github";

// ---------------------------------------------------------------------------
// Icon helpers (inline SVG strings — no extra dep)
// ---------------------------------------------------------------------------
const StarIcon = () => (
  <svg className="h-3 w-3 fill-current" viewBox="0 0 16 16">
    <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 11.55l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
  </svg>
);

const ForkIcon = () => (
  <svg className="h-3 w-3 fill-current" viewBox="0 0 16 16">
    <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 1 1.5 0v.878a2.25 2.25 0 0 1-2.25 2.25h-1.5v2.128a2.251 2.251 0 1 1-1.5 0V8.5h-1.5A2.25 2.25 0 0 1 3.5 6.25v-.878a2.25 2.25 0 1 1 1.5 0ZM5 3.25a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm6.75.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-3 8.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z" />
  </svg>
);

const IssueIcon = () => (
  <svg className="h-3 w-3 fill-current" viewBox="0 0 16 16">
    <path d="M8 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0ZM1.5 8a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Pill({
  icon,
  value,
  title,
  color,
}: {
  icon: React.ReactNode;
  value: string | number;
  title: string;
  color: string;
}) {
  return (
    <span
      title={title}
      className="flex items-center gap-1 rounded-sm border px-1.5 py-[1px] text-[9px] tracking-widest"
      style={{ borderColor: `${color}55`, color }}
    >
      {icon}
      {value}
    </span>
  );
}

function CommitLine({
  sha,
  message,
  author,
  date,
  url,
}: {
  sha: string;
  message: string;
  author: string;
  date: string;
  url: string;
}) {
  const when = formatStaleness(
    Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  );
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-1.5 overflow-hidden rounded-sm px-1 py-0.5 text-[8px] transition hover:bg-white/5"
      title={`${sha} — ${message} by ${author}`}
    >
      <span className="shrink-0 font-mono opacity-50">{sha}</span>
      <span className="flex-1 truncate opacity-75 group-hover:opacity-100">
        {message}
      </span>
      <span className="shrink-0 opacity-40">{when}</span>
    </a>
  );
}

// ---------------------------------------------------------------------------
// Main widget
// ---------------------------------------------------------------------------
interface GitHubStatusWidgetProps {
  /** "owner/repo" or full GitHub URL */
  repo?: string;
  /** Polling interval ms. Default 60 000 */
  intervalMs?: number;
  className?: string;
}

const ACCENT = "#58a6ff"; // GitHub-blue works across all ULTRONOS themes

export function GitHubStatusWidget({
  repo: repoProp,
  intervalMs = 60_000,
  className,
}: GitHubStatusWidgetProps) {
  const [inputRepo, setInputRepo] = useState(repoProp ?? "");
  const [activeRepo, setActiveRepo] = useState(repoProp ?? null);

  const state = useGitHubStatus(activeRepo, { intervalMs });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputRepo.trim();
    if (val) setActiveRepo(val);
  };

  return (
    <div
      className={clsx(
        "neon-frame flex flex-col gap-2 rounded-sm p-3",
        className
      )}
      style={{ borderColor: `${ACCENT}55`, color: ACCENT }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="pixel text-[10px] tracking-[0.15em]">GITHUB</span>
        <StatusBadge state={state} color={ACCENT} />
      </div>

      {/* Repo input */}
      <form onSubmit={handleSubmit} className="flex gap-1">
        <input
          className="flex-1 rounded-sm border px-1.5 py-0.5 text-[9px] outline-none bg-transparent placeholder-white/20"
          style={{ borderColor: `${ACCENT}44` }}
          placeholder="owner/repo or GitHub URL"
          value={inputRepo}
          onChange={(e) => setInputRepo(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-sm border px-2 py-0.5 text-[8px] uppercase tracking-widest transition hover:bg-white/10"
          style={{ borderColor: `${ACCENT}55` }}
        >
          Go
        </button>
      </form>

      {/* Content */}
      {state.status === "idle" && (
        <p className="text-[8px] opacity-40 text-center py-2">
          Enter a repo above to start monitoring
        </p>
      )}

      {state.status === "loading" && (
        <p className="animate-pulse text-[8px] opacity-50 text-center py-2">
          Fetching…
        </p>
      )}

      {state.status === "error" && (
        <p className="text-[8px] text-red-400 text-center py-1">
          ⚠ {state.message}
        </p>
      )}

      {state.status === "ok" && (
        <RepoCard data={state.data} fetchedAt={state.fetchedAt} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
function StatusBadge({
  state,
  color,
}: {
  state: ReturnType<typeof useGitHubStatus>;
  color: string;
}) {
  const label =
    state.status === "ok"
      ? "LIVE"
      : state.status === "loading"
      ? "…"
      : state.status === "error"
      ? "ERR"
      : "—";

  const pulse = state.status === "ok" || state.status === "loading";
  const dotColor =
    state.status === "ok"
      ? "#22ff88"
      : state.status === "error"
      ? "#ff3a5e"
      : color;

  return (
    <span
      className={clsx(
        "flex items-center gap-1 rounded-sm border px-1 py-[1px] text-[7px] uppercase tracking-widest",
        pulse && "animate-pulse"
      )}
      style={{ borderColor: `${color}55`, color }}
    >
      <span
        className="h-1 w-1 rounded-full"
        style={{ background: dotColor, boxShadow: `0 0 6px ${dotColor}` }}
      />
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Repo card
// ---------------------------------------------------------------------------
function RepoCard({
  data,
  fetchedAt,
}: {
  data: import("@/lib/integrations/github").GitHubRepoFull;
  fetchedAt: number;
}) {
  const color = ACCENT;
  const lastFetch = Math.floor((Date.now() - fetchedAt) / 1000);

  return (
    <div className="flex flex-col gap-2">
      {/* Repo name */}
      <a
        href={data.htmlUrl}
        target="_blank"
        rel="noreferrer"
        className="text-[10px] font-semibold hover:underline truncate"
        style={{ color }}
      >
        {data.fullName}
      </a>

      {/* Description */}
      {data.description && (
        <p className="text-[8px] opacity-60 line-clamp-2">{data.description}</p>
      )}

      {/* Stats row */}
      <div className="flex flex-wrap gap-1.5">
        <Pill
          icon={<StarIcon />}
          value={data.stars.toLocaleString()}
          title="Stars"
          color={color}
        />
        <Pill
          icon={<ForkIcon />}
          value={data.forks.toLocaleString()}
          title="Forks"
          color={color}
        />
        <Pill
          icon={<IssueIcon />}
          value={data.openIssues}
          title="Open issues"
          color={data.openIssues > 50 ? "#f97316" : color}
        />
        {data.language && (
          <Pill icon={<>{"<>"}</>} value={data.language} title="Language" color={color} />
        )}
        {data.license && (
          <Pill icon={<>{"©"}</>} value={data.license} title="License" color={color} />
        )}
      </div>

      {/* Last push */}
      <div className="flex items-center justify-between text-[8px] opacity-40">
        <span>pushed {formatStaleness(data.staleSecs)}</span>
        {data.isArchived && (
          <span className="text-yellow-400 opacity-80">ARCHIVED</span>
        )}
      </div>

      {/* Latest commit */}
      {data.latestCommit && (
        <div
          className="rounded-sm border"
          style={{ borderColor: `${color}22` }}
        >
          <div
            className="px-1 py-0.5 text-[7px] uppercase tracking-widest opacity-40 border-b"
            style={{ borderColor: `${color}22` }}
          >
            latest commit · {data.defaultBranch}
          </div>
          <CommitLine
            sha={data.latestCommit.sha}
            message={data.latestCommit.message}
            author={data.latestCommit.author}
            date={data.latestCommit.date}
            url={data.latestCommit.htmlUrl}
          />
        </div>
      )}

      {/* Refresh hint */}
      <p className="text-right text-[7px] opacity-25">
        refreshed {formatStaleness(lastFetch)}
      </p>
    </div>
  );
}
