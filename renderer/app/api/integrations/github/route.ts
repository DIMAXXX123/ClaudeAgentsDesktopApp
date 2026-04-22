/**
 * GET /api/integrations/github?repo=owner/repo
 *
 * Returns live status for a public GitHub repo (no auth required).
 * Cached by Next.js for 60s; client-side polling is recommended at ≥30s.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchRepoFull,
  parseRepoRef,
  type GitHubRepoFull,
} from "@/lib/integrations/github";

export const runtime = "edge";
// Revalidate page cache every 60 seconds
export const revalidate = 60;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const repoParam = searchParams.get("repo");

  if (!repoParam) {
    return errorResponse('Missing "repo" query param (e.g. ?repo=vercel/next.js)', 400);
  }

  let owner: string;
  let repo: string;
  try {
    ({ owner, repo } = parseRepoRef(repoParam));
  } catch {
    return errorResponse(`Invalid repo: "${repoParam}"`, 400);
  }

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8000);
    let data: GitHubRepoFull;
    try {
      data = await fetchRepoFull(owner, repo, ac.signal);
    } finally {
      clearTimeout(timer);
    }

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      return errorResponse(`Repo "${owner}/${repo}" not found or private`, 404);
    }
    if (msg.includes("403")) {
      return errorResponse("GitHub rate limit exceeded — try again in 60s", 429);
    }
    console.error("[github-integration]", msg);
    return errorResponse("Failed to fetch repo status", 502);
  }
}
