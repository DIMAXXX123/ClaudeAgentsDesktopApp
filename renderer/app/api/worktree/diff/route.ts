import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/worktree/diff?worktreePath=...&baseRef=...
 * HTTP fallback for getting worktree diffs.
 */
export async function GET(request: NextRequest) {
  const worktreePath = request.nextUrl.searchParams.get('worktreePath');
  const baseRef = request.nextUrl.searchParams.get('baseRef') || 'HEAD';

  if (!worktreePath) {
    return NextResponse.json({ error: 'worktreePath is required' }, { status: 400 });
  }

  try {
    // Use window.ultronos.worktree.diff() instead
    return NextResponse.json({
      error: 'Use window.ultronos.worktree.diff() instead of HTTP route',
    }, { status: 501 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
