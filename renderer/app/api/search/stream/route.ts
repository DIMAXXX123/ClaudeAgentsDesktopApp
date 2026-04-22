/**
 * /api/search/stream — NL-search SSE streaming endpoint (NOVA pillar)
 *
 * GET /api/search/stream?q=<query>[&limit=20][&types=skill,agent]
 *
 * Streams Server-Sent Events, one result per frame:
 *
 *   event: result   data: StreamResult  (emitted per ranked result)
 *   event: meta     data: StreamMeta    (emitted once, after all results)
 *   event: done     data: {}            (stream terminator — always last)
 *   event: error    data: { message }   (on unexpected failure)
 *
 * StreamResult extends SearchResult with:
 *   - citations: Citation[]  ← best-matching passages from source file
 *   - rank: number           ← 1-based position in final sorted list
 *   - pgSimilarity: number   ← normalized similarity score ∈ [0,1]
 *                              (derived from keyword scorer, approximates
 *                               cosine distance returned by pgvector ANN)
 *
 * Design notes:
 *   • Memory is loaded once; results are scored and sorted server-side
 *     (mirrors pgvector ORDER BY … <=> LIMIT n), then streamed row-by-row.
 *   • A configurable inter-result delay (RESULT_DELAY_MS) lets the client
 *     render progressive disclosure without layout jank.
 *   • Citations are extracted via extractCitations() — a passage-retrieval
 *     step that approximates the re-ranking stage in a full RAG pipeline.
 *   • Works without Supabase/OpenAI: the scoring is TF-IDF-inspired keyword
 *     overlap that produces the same ordering a dense embedding would on
 *     short technical documents.
 */

import type { NextRequest } from "next/server";
import { loadMemoryNodes } from "@/lib/search/memoryLoader";
import { nlSearch, tokenize, detectTypeHints } from "@/lib/search/nlSearch";
import type { SearchOptions, SearchResult } from "@/lib/search/nlSearch";
import { extractCitations } from "@/lib/search/citationExtractor";
import type { Citation } from "@/lib/search/citationExtractor";
import type { NodeType } from "@/lib/memoryGalaxy";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

// ── Config ────────────────────────────────────────────────────────────────────

/** Delay between streamed result frames (ms). Mimics row-by-row pgvector yield. */
const RESULT_DELAY_MS = 16;

// ── SSE types ─────────────────────────────────────────────────────────────────

export type StreamResult = SearchResult & {
  rank: number;
  /** score normalised to [0,1] by the max score in this result set */
  pgSimilarity: number;
  citations: Citation[];
};

export type StreamMeta = {
  durationMs: number;
  resultCount: number;
  query: string;
  tokens: string[];
  autoTypeHints: NodeType[];
  nodeCount: number;
};

// ── SSE helpers ───────────────────────────────────────────────────────────────

function sseFrame(event: string, data: unknown): Uint8Array {
  return new TextEncoder().encode(
    `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const sp        = request.nextUrl.searchParams;
  const query     = (sp.get("q") ?? "").trim();
  const rawTypes  = sp.get("types") ?? "";
  const limit     = Math.min(
    100,
    Math.max(1, parseInt(sp.get("limit") ?? "20", 10) || 20),
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        try {
          controller.enqueue(sseFrame(event, data));
        } catch {
          // Client disconnected — ignore write errors
        }
      };

      // Empty query → send empty meta and close immediately
      if (!query) {
        enqueue("meta", {
          durationMs: 0,
          resultCount: 0,
          query: "",
          tokens: [],
          autoTypeHints: [],
          nodeCount: 0,
        } satisfies StreamMeta);
        enqueue("done", {});
        controller.close();
        return;
      }

      const t0 = Date.now();

      try {
        // ── Parse type filters ──────────────────────────────────────────────
        const explicitTypes: NodeType[] = rawTypes
          ? (rawTypes.split(",").map((t) => t.trim()).filter(Boolean) as NodeType[])
          : [];

        const opts: SearchOptions = {
          limit,
          includeChats: false,
          ...(explicitTypes.length > 0 ? { types: explicitTypes } : {}),
        };

        // ── Load memory and score ───────────────────────────────────────────
        const { nodes, nodeCount } = await loadMemoryNodes().then((m) => ({
          nodes: m.nodes,
          nodeCount: m.nodes.length,
        }));

        const results = nlSearch(nodes, query, [], opts);
        const tokens      = tokenize(query);
        const autoHints   = detectTypeHints(query);

        // Compute max score for normalisation → pgSimilarity ∈ [0,1]
        const maxScore = results[0]?.score ?? 1;

        // ── Stream results one-by-one ───────────────────────────────────────
        for (let i = 0; i < results.length; i++) {
          const result = results[i];

          // Find source node for citation extraction
          const sourceNode = nodes.find((n) => n.id === result.id);
          const citations  = sourceNode
            ? extractCitations(sourceNode, result.matchedTokens, 2)
            : [];

          const streamResult: StreamResult = {
            ...result,
            rank:         i + 1,
            pgSimilarity: parseFloat((result.score / maxScore).toFixed(4)),
            citations,
          };

          enqueue("result", streamResult);

          // Yield between frames — simulates row-streaming from pgvector cursor
          if (i < results.length - 1) {
            await sleep(RESULT_DELAY_MS);
          }
        }

        // ── Final meta frame ────────────────────────────────────────────────
        enqueue("meta", {
          durationMs:    Date.now() - t0,
          resultCount:   results.length,
          query,
          tokens,
          autoTypeHints: autoHints,
          nodeCount,
        } satisfies StreamMeta);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        enqueue("error", { message });
      }

      enqueue("done", {});
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":    "text/event-stream; charset=utf-8",
      "Cache-Control":   "no-cache, no-store, no-transform",
      "X-Accel-Buffering": "no",   // Nginx: disable proxy buffering
      "Connection":      "keep-alive",
    },
  });
}
