import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/worktree/create
 * HTTP fallback for creating worktrees.
 * Body: { repoPath: string, agentId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoPath, agentId } = body;

    if (!repoPath || !agentId) {
      return NextResponse.json(
        { error: 'repoPath and agentId are required' },
        { status: 400 }
      );
    }

    // Use window.ultronos.worktree.create() instead
    return NextResponse.json({
      error: 'Use window.ultronos.worktree.create() instead of HTTP route',
    }, { status: 501 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
