'use client';

import React, { useState } from 'react';
import { Worktree } from '@/lib/useWorktrees';
import WorktreeDiffModal from './WorktreeDiffModal';

interface WorktreePanelProps {
  worktrees: Worktree[];
  loading: boolean;
  error?: string | null;
  onRemove: (path: string, force?: boolean) => Promise<void>;
  onPrune?: () => Promise<void>;
}

export default function WorktreePanel({
  worktrees,
  loading,
  error,
  onRemove,
  onPrune,
}: WorktreePanelProps) {
  const [selectedWorktree, setSelectedWorktree] = useState<Worktree | null>(null);
  const [showDiffModal, setShowDiffModal] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);

  const handleRemove = async (path: string) => {
    setRemovingPath(path);
    try {
      await onRemove(path, false);
    } catch (err) {
      if (err instanceof Error && err.message.includes('uncommitted changes')) {
        // Offer force remove
        if (confirm('Worktree has changes. Force remove?')) {
          try {
            await onRemove(path, true);
          } catch (forceErr) {
            console.error('Force remove failed:', forceErr);
          }
        }
      }
    } finally {
      setRemovingPath(null);
    }
  };

  const handleViewDiff = (worktree: Worktree) => {
    setSelectedWorktree(worktree);
    setShowDiffModal(true);
  };

  if (loading && worktrees.length === 0) {
    return <div className="p-4 text-sm">Loading worktrees...</div>;
  }

  if (worktrees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="mb-4 text-sm">No active worktrees</p>
        {onPrune && (
          <button onClick={onPrune} className="px-3 py-1 text-xs border rounded">
            Prune Stale
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {error && <div className="rounded border border-red-400 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Active Worktrees ({worktrees.length})</h3>
          {onPrune && (
            <button onClick={onPrune} className="text-xs text-blue-600 hover:underline">
              Prune Stale
            </button>
          )}
        </div>

        <div className="space-y-3">
          {worktrees.map((wt) => (
            <div key={wt.path} className="overflow-hidden rounded border">
              <div className="border-b p-3 pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs">{wt.path.split('/').pop()}</p>
                    <p className="mt-1 text-xs">Branch: {wt.branch}</p>
                  </div>
                  <div className="flex gap-1">
                    {wt.hasChanges && <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded">Changes</span>}
                    {wt.agentId && <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{wt.agentId}</span>}
                  </div>
                </div>
              </div>

              <div className="p-3 space-y-2">
                <p className="text-xs break-all">{wt.path}</p>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleViewDiff(wt)}
                    className="flex-1 rounded border px-2 py-1 text-xs hover:bg-gray-100"
                  >
                    View Diff
                  </button>
                  <button
                    onClick={() => handleRemove(wt.path)}
                    disabled={removingPath === wt.path}
                    className="flex-1 rounded border border-red-400 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {removingPath === wt.path ? 'Removing...' : 'Remove'}
                  </button>
                </div>

                {wt.createdAt && (
                  <p className="text-xs">Created: {new Date(wt.createdAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedWorktree && (
        <WorktreeDiffModal
          open={showDiffModal}
          onOpenChange={setShowDiffModal}
          worktree={selectedWorktree}
        />
      )}
    </>
  );
}
