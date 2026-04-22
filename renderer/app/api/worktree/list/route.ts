import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/worktree/list?repoPath=...
 * HTTP fallback for listing worktrees.
 */
export async function GET(request: NextRequest) {
  const repoPath = request.nextUrl.searchParams.get('repoPath');

  if (!repoPath) {
    return NextResponse.json({ error: 'repoPath is required' }, { status: 400 });
  }

  try {
    // In a real scenario, this would call the IPC handler.
    // For now, return a placeholder that client code can call IPC directly.
    return NextResponse.json({
      error: 'Use window.ultronos.worktree.list() instead of HTTP route',
    }, { status: 501 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
