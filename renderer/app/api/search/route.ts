/**
 * /api/search — NL-search API (NOVA pillar)
 *
 * GET  /api/search?q=<query>[&limit=20][&types=skill,agent][&includeChats=false]
 *   → searches server-side memory only (no chat history)
 *
 * POST /api/search   body: { query, limit?, types?, chatSnippets? }
 *   → same search + client-supplied chat snippets for cross-room search
 *
 * Response: { ok, results: SearchResult[], meta: { durationMs, rawCount, tokens } }
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadMemoryNodes, parseChatSnippets } from "@/lib/search/memoryLoader";
import { nlSearch, detectTypeHints, tokenize } from "@/lib/search/nlSearch";
import type { SearchOptions } from "@/lib/search/nlSearch";
import type { NodeType } from "@/lib/memoryGalaxy";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

// ── Shared search runner ──────────────────────────────────────────────────────

async function runSearch(
  query: string,
  rawTypes: string,
  limit: number,
  includeChats: boolean,
  rawChatSnippets: unknown,
) {
  const t0 = Date.now();

  // Parse type filters
  const explicitTypes: NodeType[] = rawTypes
    ? (rawTypes.split(",").map((t) => t.trim()).filter(Boolean) as NodeType[])
    : [];

  // Build search options (explicit types override NL-detected hints)
  const opts: SearchOptions = {
    limit,
    includeChats,
    ...(explicitTypes.length > 0 ? { types: explicitTypes } : {}),
  };

  // Load nodes
  const { nodes, rawCount, buckets } = await loadMemoryNodes();

  // Parse chat snippets (POST body) or skip (GET)
  const chats = parseChatSnippets(rawChatSnippets);

  // Run search
  const results = nlSearch(nodes, query, chats, opts);

  const durationMs = Date.now() - t0;
  const tokens = tokenize(query);
  const autoHints = detectTypeHints(query);

  return NextResponse.json({
    ok: true,
    results,
    meta: {
      durationMs,
      rawCount,
      nodeCount: nodes.length,
      chatCount: chats.length,
      resultCount: results.length,
      tokens,
      autoTypeHints: autoHints,
      buckets,
    },
  });
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const query         = (sp.get("q") ?? "").trim();
    const rawTypes      = sp.get("types") ?? "";
    const limit         = Math.min(100, Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20));
    const includeChats  = sp.get("includeChats") !== "false";

    if (!query) {
      return NextResponse.json({ ok: true, results: [], meta: { durationMs: 0, rawCount: 0, nodeCount: 0, chatCount: 0, resultCount: 0, tokens: [], autoTypeHints: [], buckets: [] } });
    }

    return runSearch(query, rawTypes, limit, includeChats, undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

type SearchBody = {
  query?: unknown;
  limit?: unknown;
  types?: unknown;
  includeChats?: unknown;
  chatSnippets?: unknown;
};

export async function POST(request: NextRequest) {
  try {
    let body: SearchBody = {};
    try {
      body = (await request.json()) as SearchBody;
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const query        = typeof body.query === "string" ? body.query.trim() : "";
    const rawTypes     = Array.isArray(body.types)
      ? (body.types as string[]).join(",")
      : typeof body.types === "string"
        ? body.types
        : "";
    const limit        = typeof body.limit === "number"
      ? Math.min(100, Math.max(1, body.limit))
      : 20;
    const includeChats = body.includeChats !== false;

    if (!query) {
      return NextResponse.json({ ok: false, error: "query is required" }, { status: 400 });
    }

    return runSearch(query, rawTypes, limit, includeChats, body.chatSnippets);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
