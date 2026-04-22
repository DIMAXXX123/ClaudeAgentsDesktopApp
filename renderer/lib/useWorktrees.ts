'use client';

import { useState, useCallback, useEffect } from 'react';

export interface Worktree {
  path: string;
  branch: string;
  agentId?: string;
  createdAt: string;
  hasChanges?: boolean;
}

export interface UseWorktreesReturn {
  worktrees: Worktree[];
  loading: boolean;
  error: string | null;
  createForAgent: (repoPath: string, agentId: string) => Promise<void>;
  removeWorktree: (path: string, force?: boolean) => Promise<void>;
  pruneStale: (repoPath: string) => Promise<number>;
  refresh: (repoPath: string) => Promise<void>;
  getDiff: (path: string, baseRef?: string) => Promise<string>;
}

/**
 * Hook for managing git worktrees.
 * Auto-refreshes every 15 seconds.
 */
export function useWorktrees(repoPath: string): UseWorktreesReturn {
  const [worktrees, setWorktrees] = useState<Worktree[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (path: string) => {
      if (!path) return;
      setLoading(true);
      setError(null);

      try {
        const result = await window.ultronos?.worktree.list(path);
        if (result?.success && result.data) {
          setWorktrees(result.data);
        } else {
          setError(result?.error || 'Failed to list worktrees');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const createForAgent = useCallback(async (path: string, agentId: string) => {
    setError(null);
    try {
      const result = await window.ultronos?.worktree.create(path, agentId);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to create worktree');
      }
      await refresh(path);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [refresh]);

  const removeWorktree = useCallback(
    async (path: string, force = false) => {
      setError(null);
      try {
        const result = await window.ultronos?.worktree.remove(path, force);
        if (!result?.success) {
          throw new Error(result?.error || 'Failed to remove worktree');
        }
        setWorktrees((prev) => prev.filter((w) => w.path !== path));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        throw err;
      }
    },
    []
  );

  const pruneStale = useCallback(async (path: string): Promise<number> => {
    setError(null);
    try {
      const result = await window.ultronos?.worktree.prune(path);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to prune worktrees');
      }
      await refresh(path);
      return result.data?.pruned ?? 0;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, [refresh]);

  const getDiff = useCallback(async (path: string, baseRef = 'HEAD'): Promise<string> => {
    setError(null);
    try {
      const result = await window.ultronos?.worktree.diff(path, baseRef);
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to get diff');
      }
      return result.data?.diff ?? '';
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      throw err;
    }
  }, []);

  // Auto-refresh every 15 seconds
  useEffect(() => {
    if (!repoPath) return;

    refresh(repoPath);
    const interval = setInterval(() => refresh(repoPath), 15000);

    return () => clearInterval(interval);
  }, [repoPath, refresh]);

  return {
    worktrees,
    loading,
    error,
    createForAgent,
    removeWorktree,
    pruneStale,
    refresh,
    getDiff,
  };
}
