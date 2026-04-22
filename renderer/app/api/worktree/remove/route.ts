import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/worktree/remove
 * HTTP fallback for removing worktrees.
 * Body: { worktreePath: string, force?: boolean }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { worktreePath, force } = body;

    if (!worktreePath) {
      return NextResponse.json(
        { error: 'worktreePath is required' },
        { status: 400 }
      );
    }

    // Use window.ultronos.worktree.remove() instead
    return NextResponse.json({
      error: 'Use window.ultronos.worktree.remove() instead of HTTP route',
    }, { status: 501 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
