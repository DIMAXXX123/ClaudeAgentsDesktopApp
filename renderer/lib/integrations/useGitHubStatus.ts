/**
 * React hook: polls /api/integrations/github every `intervalMs` milliseconds.
 * Returns live repo data, loading state, and last error.
 */
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { GitHubRepoFull } from "./github";

export type GitHubStatusState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: GitHubRepoFull; fetchedAt: number }
  | { status: "error"; message: string; fetchedAt: number };

interface Options {
  /** Polling interval in ms. Default 60 000 (1 min). Minimum 10 000. */
  intervalMs?: number;
  /** Set to false to pause polling. Default true. */
  enabled?: boolean;
}

export function useGitHubStatus(
  repo: string | null,
  { intervalMs = 60_000, enabled = true }: Options = {}
): GitHubStatusState {
  const [state, setState] = useState<GitHubStatusState>({ status: "idle" });
  const effectiveInterval = Math.max(intervalMs, 10_000);
  const repoRef = useRef(repo);
  repoRef.current = repo;

  const doFetch = useCallback(async (signal: AbortSignal) => {
    const r = repoRef.current;
    if (!r) return;
    setState({ status: "loading" });
    try {
      const res = await fetch(
        `/api/integrations/github?repo=${encodeURIComponent(r)}`,
        { signal }
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as GitHubRepoFull;
      setState({ status: "ok", data, fetchedAt: Date.now() });
    } catch (err: unknown) {
      if ((err as { name?: string }).name === "AbortError") return;
      const message =
        err instanceof Error ? err.message : "Unknown error";
      setState({ status: "error", message, fetchedAt: Date.now() });
    }
  }, []);

  useEffect(() => {
    if (!enabled || !repo) {
      setState({ status: "idle" });
      return;
    }
    const ac = new AbortController();
    void doFetch(ac.signal);
    const interval = setInterval(() => void doFetch(ac.signal), effectiveInterval);
    return () => {
      ac.abort();
      clearInterval(interval);
    };
  }, [repo, enabled, effectiveInterval, doFetch]);

  return state;
}
