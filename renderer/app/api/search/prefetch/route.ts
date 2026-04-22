/**
 * /api/search/prefetch — NOVA pillar batch-prefetch endpoint
 *
 * POST body: { queries: string[], limit?: number }
 * Response:  { ok: true, results: Record<string, SearchResult[]>, meta: { durationMs, count } }
 *
 * Runs all queries in parallel on the server so the client can warm its
 * React 19 cache before the user types each predicted query.
 *
 * Design: low-priority — no error thrown for individual query failures
 * (bad query → empty result for that slot). Limit per query is capped at 10
 * to keep the payload small.
 */

import { NextResponse }                        from "next/server";
import type { NextRequest }                    from "next/server";
import { loadMemoryNodes }                     from "@/lib/search/memoryLoader";
import { nlSearch, tokenize, detectTypeHints } from "@/lib/search/nlSearch";
import type { SearchResult }                   from "@/lib/search/nlSearch";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const MAX_QUERIES   = 8;   // max predictions per request
const MAX_PER_QUERY = 10;  // max results per predicted query

type PrefetchBody = {
  queries?: unknown;
  limit?:   unknown;
};

async function runOneQuery(
  query: string,
  limit: number,
  nodes: Awaited<ReturnType<typeof loadMemoryNodes>>["nodes"],
): Promise<SearchResult[]> {
  try {
    const results = nlSearch(nodes, query, [], { limit, includeChats: false });
    return results;
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const t0 = Date.now();

  let body: PrefetchBody = {};
  try {
    body = (await request.json()) as PrefetchBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Validate queries array
  if (!Array.isArray(body.queries) || body.queries.length === 0) {
    return NextResponse.json({ ok: false, error: "queries must be a non-empty array" }, { status: 400 });
  }

  const queries: string[] = (body.queries as unknown[])
    .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
    .map((q) => q.trim())
    .slice(0, MAX_QUERIES);

  const limit = typeof body.limit === "number"
    ? Math.min(MAX_PER_QUERY, Math.max(1, body.limit))
    : MAX_PER_QUERY;

  // Load memory once, run all queries in parallel
  const { nodes } = await loadMemoryNodes();

  const settled = await Promise.allSettled(
    queries.map((q) => runOneQuery(q, limit, nodes)),
  );

  const results: Record<string, SearchResult[]> = {};
  for (let i = 0; i < queries.length; i++) {
    const r = settled[i];
    results[queries[i]] = r.status === "fulfilled" ? r.value : [];
  }

  return NextResponse.json({
    ok: true,
    results,
    meta: {
      durationMs: Date.now() - t0,
      count:      queries.length,
      // Include token counts for debugging
      tokens: Object.fromEntries(
        queries.map((q) => [q, tokenize(q)]),
      ),
      typeHints: Object.fromEntries(
        queries.map((q) => [q, detectTypeHints(q)]),
      ),
    },
  });
}
