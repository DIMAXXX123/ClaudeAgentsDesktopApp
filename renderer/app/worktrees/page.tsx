'use client';

import React, { useState, useCallback } from 'react';
import { useWorktrees } from '@/lib/useWorktrees';
import WorktreePanel from '@/components/worktree/WorktreePanel';

export default function WorktreesPage() {
  const [repoPath, setRepoPath] = useState<string>('');
  const [initialRepoPath, setInitialRepoPath] = useState<string>('');
  const { worktrees, loading, error, createForAgent, removeWorktree, pruneStale, refresh, getDiff } =
    useWorktrees(initialRepoPath);

  const handleSetRepo = useCallback(() => {
    if (repoPath.trim()) {
      setInitialRepoPath(repoPath);
    }
  }, [repoPath]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSetRepo();
    }
  };

  const handleCreateWorktree = useCallback(
    async (agentId: string) => {
      try {
        await createForAgent(initialRepoPath, agentId);
      } catch (err) {
        console.error('Failed to create worktree:', err);
      }
    },
    [initialRepoPath, createForAgent]
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Git Worktree Manager</h1>
        <p className="text-sm">Manage isolated git worktrees for parallel agent development</p>
      </div>

      {/* Repository Path Input */}
      <div className="mb-6 rounded border">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">Repository Path</h3>
        </div>
        <div className="p-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Enter repository path..."
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
            <button onClick={handleSetRepo} className="rounded border bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-700">
              Load
            </button>
          </div>
          {initialRepoPath && <p className="mt-2 text-xs">Current: {initialRepoPath}</p>}
        </div>
      </div>

      {!initialRepoPath && (
        <div className="flex items-center justify-center p-12 text-center text-sm">
          <p>Enter a repository path to get started</p>
        </div>
      )}

      {initialRepoPath && (
        <>
          {/* Create Worktree Section */}
          <div className="mb-6 rounded border">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">Create Worktree</h3>
            </div>
            <div className="p-4">
              <div className="flex gap-2">
                <input
                  id="agentId"
                  type="text"
                  placeholder="Agent ID (e.g., agent-1, worker-a)"
                  className="flex-1 rounded border px-2 py-1 text-sm"
                  onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        handleCreateWorktree(input.value.trim());
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById('agentId') as HTMLInputElement | null;
                    if (input?.value.trim()) {
                      handleCreateWorktree(input.value.trim());
                      input.value = '';
                    }
                  }}
                  className="rounded border bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>

          {/* Worktrees List */}
          <div className="rounded border">
            <div className="border-b p-4">
              <h3 className="text-sm font-semibold">Active Worktrees</h3>
            </div>
            <div className="p-4">
              <WorktreePanel
                worktrees={worktrees}
                loading={loading}
                error={error}
                onRemove={removeWorktree}
                onPrune={async () => {
                  await pruneStale(initialRepoPath);
                }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
