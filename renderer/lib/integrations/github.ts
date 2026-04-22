/**
 * GitHub public-repo status integration for ULTRONOS.
 * No auth required — works with any public repository.
 *
 * WHY: agents reference GitHub repos; showing live stars/issues/CI
 *      in the status bar gives instant repo health at a glance.
 */

export interface GitHubRepoStatus {
  owner: string;
  repo: string;
  fullName: string;
  description: string | null;
  stars: number;
  forks: number;
  openIssues: number;
  language: string | null;
  defaultBranch: string;
  isArchived: boolean;
  license: string | null;
  pushedAt: string | null;
  htmlUrl: string;
  /** Seconds since last push */
  staleSecs: number;
}

export interface GitHubCommitInfo {
  sha: string;
  message: string;
  author: string;
  date: string;
  htmlUrl: string;
}

export interface GitHubRepoFull extends GitHubRepoStatus {
  latestCommit: GitHubCommitInfo | null;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function repoStatusFromJson(json: Record<string, unknown>): GitHubRepoStatus {
  const pushedAt = (json.pushed_at as string | null) ?? null;
  const staleSecs = pushedAt
    ? Math.floor((Date.now() - new Date(pushedAt).getTime()) / 1000)
    : -1;
  return {
    owner: (json.owner as { login: string }).login,
    repo: json.name as string,
    fullName: json.full_name as string,
    description: (json.description as string | null) ?? null,
    stars: (json.stargazers_count as number) ?? 0,
    forks: (json.forks_count as number) ?? 0,
    openIssues: (json.open_issues_count as number) ?? 0,
    language: (json.language as string | null) ?? null,
    defaultBranch: (json.default_branch as string) ?? "main",
    isArchived: (json.archived as boolean) ?? false,
    license:
      (json.license as { spdx_id: string } | null)?.spdx_id ?? null,
    pushedAt,
    htmlUrl: (json.html_url as string) ?? "",
    staleSecs,
  };
}

function commitFromJson(json: Record<string, unknown>): GitHubCommitInfo {
  const c = json.commit as Record<string, unknown>;
  const author = c.author as Record<string, unknown>;
  return {
    sha: (json.sha as string).slice(0, 7),
    message: ((c.message as string) ?? "").split("\n")[0],
    author: (author.name as string) ?? "unknown",
    date: (author.date as string) ?? "",
    htmlUrl: (json.html_url as string) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

const GH_API = "https://api.github.com";

/** Fetch public repo metadata. Throws on 4xx/5xx. */
export async function fetchRepoStatus(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<GitHubRepoStatus> {
  const res = await fetch(`${GH_API}/repos/${owner}/${repo}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
    next: { revalidate: 60 }, // Next.js cache — refresh every 60s
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return repoStatusFromJson(json);
}

/** Fetch latest commit on the default branch. Returns null on failure. */
export async function fetchLatestCommit(
  owner: string,
  repo: string,
  branch: string,
  signal?: AbortSignal
): Promise<GitHubCommitInfo | null> {
  try {
    const res = await fetch(
      `${GH_API}/repos/${owner}/${repo}/commits/${branch}`,
      {
        headers: { Accept: "application/vnd.github+json" },
        signal,
        next: { revalidate: 60 },
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return commitFromJson(json);
  } catch {
    return null;
  }
}

/** Composite: fetch repo + latest commit in parallel. */
export async function fetchRepoFull(
  owner: string,
  repo: string,
  signal?: AbortSignal
): Promise<GitHubRepoFull> {
  const status = await fetchRepoStatus(owner, repo, signal);
  const latestCommit = await fetchLatestCommit(
    owner,
    repo,
    status.defaultBranch,
    signal
  );
  return { ...status, latestCommit };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "owner/repo" or full GitHub URL into { owner, repo }. */
export function parseRepoRef(ref: string): { owner: string; repo: string } {
  // Strip trailing .git
  const clean = ref.replace(/\.git$/, "").trim();
  // URL form: https://github.com/owner/repo[/...]
  const urlMatch = clean.match(
    /github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/
  );
  if (urlMatch) return { owner: urlMatch[1], repo: urlMatch[2] };
  // Slug form: owner/repo
  const slugMatch = clean.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
  if (slugMatch) return { owner: slugMatch[1], repo: slugMatch[2] };
  throw new Error(`Cannot parse repo ref: "${ref}"`);
}

/** Format staleness into human-readable string. */
export function formatStaleness(staleSecs: number): string {
  if (staleSecs < 0) return "unknown";
  if (staleSecs < 60) return "just now";
  if (staleSecs < 3600) return `${Math.floor(staleSecs / 60)}m ago`;
  if (staleSecs < 86400) return `${Math.floor(staleSecs / 3600)}h ago`;
  if (staleSecs < 86400 * 30) return `${Math.floor(staleSecs / 86400)}d ago`;
  return `${Math.floor(staleSecs / (86400 * 30))}mo ago`;
}
