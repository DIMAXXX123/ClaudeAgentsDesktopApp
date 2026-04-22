'use client';

import React, { useEffect, useState } from 'react';
import { Worktree } from '@/lib/useWorktrees';

interface WorktreeDiffModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worktree: Worktree;
}

export default function WorktreeDiffModal({
  open,
  onOpenChange,
  worktree,
}: WorktreeDiffModalProps) {
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !worktree) return;

    const fetchDiff = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await window.ultronos?.worktree.diff(worktree.path, 'HEAD');
        if (result?.success && result.data) {
          setDiff(result.data.diff);
        } else {
          setError(result?.error || 'Failed to fetch diff');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [open, worktree]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(diff);
      alert('Diff copied to clipboard');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="max-w-3xl max-h-[80vh] w-full mx-4 flex flex-col rounded-lg border bg-white shadow-lg">
        <div className="border-b p-4">
          <h2 className="font-mono text-sm">Diff: {worktree.branch}</h2>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col p-4">
          {loading && <div className="flex items-center justify-center p-8 text-xs">Loading diff...</div>}

          {error && <div className="rounded border border-red-400 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

          {!loading && !error && (
            <div className="flex-1 overflow-auto bg-gray-50 rounded p-4">
              {diff ? (
                <pre className="font-mono text-xs whitespace-pre-wrap break-words">{diff}</pre>
              ) : (
                <p className="text-xs">No changes</p>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end border-t p-4">
          {diff && (
            <button onClick={handleCopy} className="px-3 py-1 text-xs border rounded hover:bg-gray-100">
              Copy
            </button>
          )}
          <button onClick={() => onOpenChange(false)} className="px-3 py-1 text-xs border rounded bg-gray-100 hover:bg-gray-200">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
