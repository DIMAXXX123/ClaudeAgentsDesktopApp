/**
 * SCOUT worker — long-running process searching the web for feature ideas
 * that CONDUCTOR can feed into agent briefs on re-plan.
 *
 * Runs as a forked child process. Appends to .overnight-plan/scout-feed.jsonl.
 *
 * Lifecycle:
 *   - parent starts via `child_process.fork(__filename)` with env CONDUCTOR_SCOUT=1
 *   - worker loops every SCOUT_CYCLE_MS (15 min), searches, filters, writes.
 *   - parent sends { type: "stop" } to shut it down cleanly; worker also listens for SIGTERM.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const PROJECT_ROOT = process.cwd();
const FEED = path.join(PROJECT_ROOT, ".overnight-plan", "scout-feed.jsonl");
const SCOUT_LOG = path.join(PROJECT_ROOT, ".overnight-plan", "scout.log");
const PID_FILE = path.join(PROJECT_ROOT, ".overnight-plan", "scout.pid");

const CYCLE_MS = 15 * 60 * 1000;
const MAX_IDEAS_PER_CYCLE = 20;

type Pillar = "ultron" | "nova" | "forge" | "ares" | "echo" | "midas" | "any";

const PILLAR_KEYWORDS: Record<Pillar, string[]> = {
  ultron: ["command palette", "keyboard shortcuts", "macro", "orchestration", "multi-agent chat", "session replay"],
  nova: ["search", "RAG", "embeddings", "knowledge graph", "citation", "semantic search", "memory"],
  forge: ["theme", "design system", "layout editor", "animation", "CSS", "typography", "UI kit", "tailwind"],
  ares: ["property-based testing", "fast-check", "playwright", "vitest", "mutation testing", "e2e", "error boundary"],
  echo: ["webhook", "telegram bot", "HN api", "github api", "crypto api", "uptime", "status page", "rss"],
  midas: ["recharts", "dashboard", "analytics", "heatmap", "sparkline", "cost tracking", "anomaly detection"],
  any: [],
};

function log(line: string) {
  const ts = new Date().toISOString();
  try {
    fs.appendFileSync(SCOUT_LOG, `[${ts}] ${line}\n`);
  } catch {
    // ignore
  }
}

function loadSeen(): Set<string> {
  const seen = new Set<string>();
  try {
    const raw = fs.readFileSync(FEED, "utf8");
    for (const line of raw.split(/\n/)) {
      if (!line.trim()) continue;
      try {
        const idea = JSON.parse(line) as { sourceUrl?: string; idea: string };
        if (idea.sourceUrl) seen.add(idea.sourceUrl);
        seen.add(crypto.createHash("sha1").update(idea.idea.toLowerCase()).digest("hex").slice(0, 16));
      } catch {
        // skip
      }
    }
  } catch {
    // no feed yet
  }
  return seen;
}

function appendIdea(idea: {
  pillar: Pillar;
  idea: string;
  sourceUrl?: string;
  rank: number;
  tags: string[];
}) {
  const entry = { ts: new Date().toISOString(), ...idea };
  fs.appendFileSync(FEED, JSON.stringify(entry) + "\n");
}

function classifyPillar(text: string): Pillar {
  const lc = text.toLowerCase();
  let best: Pillar = "any";
  let bestScore = 0;
  for (const [pillar, kws] of Object.entries(PILLAR_KEYWORDS) as [Pillar, string[]][]) {
    if (pillar === "any") continue;
    let score = 0;
    for (const kw of kws) if (lc.includes(kw.toLowerCase())) score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = pillar;
    }
  }
  return best;
}

function rankIdea(text: string, pillar: Pillar): number {
  // simple heuristic: length + pillar-specificity + buzzword count
  const kws = PILLAR_KEYWORDS[pillar] ?? [];
  const lc = text.toLowerCase();
  let r = 0;
  for (const kw of kws) if (lc.includes(kw.toLowerCase())) r += 2;
  if (text.length > 30 && text.length < 200) r += 1;
  if (/\b(react 19|next\.js 15|shadcn|framer|radix)\b/i.test(text)) r += 2;
  return r;
}

type SdkQueryModule = {
  query: (args: {
    prompt: string;
    options: {
      cwd: string;
      allowedTools: string[];
      permissionMode: "bypassPermissions";
      maxTurns: number;
      model?: string;
    };
  }) => AsyncIterable<unknown>;
};

async function loadSdk(): Promise<SdkQueryModule | null> {
  try {
    const mod = (await import("@anthropic-ai/claude-agent-sdk")) as unknown as SdkQueryModule;
    return mod;
  } catch (e) {
    log(`sdk import failed: ${(e as Error).message}`);
    return null;
  }
}

const PROMPT_TEMPLATE = `
You are SCOUT for ULTRONOS — finding fresh feature ideas for a Next.js 15 + React 19 command-station dashboard.

There are 6 pillars (each agent owns one lane). For each pillar list 2-3 concrete, specific ideas. Ideas must be:
- SPECIFIC (not "improve UI"), 8-20 words each
- IMPLEMENTABLE in 30 min by an AI agent
- FRESH (reference modern libs / patterns when relevant)
- NO duplicates of previous scout ideas

Pillars:
- ultron (orchestration): command palette, macros, session replay, multi-agent chat
- nova (knowledge): NL-search, RAG, citation graph, semantic memory
- forge (theming/panels): ThemeSwitcher, LayoutEditor, backgrounds, typography
- ares (self-test): property tests, e2e, mutation, coverage
- echo (integrations): webhooks, telegram, GitHub, crypto, uptime
- midas (analytics): cost dashboards, charts, heatmaps, insights

Use WebSearch/WebFetch to browse:
- https://news.ycombinator.com (front page, show HN)
- awesome-nextjs / awesome-react lists on GitHub
- shadcn/ui new components
- Tailwind plus / Framer Motion examples

Output EXACT JSON array (no prose), each entry:
{ "pillar": "ultron|nova|forge|ares|echo|midas", "idea": "...", "sourceUrl": "optional url", "tags": ["react19", "shadcn", ...] }

Return AT MOST 12 ideas.
`.trim();

async function runCycle(seen: Set<string>): Promise<number> {
  const sdk = await loadSdk();
  if (!sdk) return 0;

  let buf = "";
  try {
    const q = sdk.query({
      prompt: PROMPT_TEMPLATE,
      options: {
        cwd: PROJECT_ROOT,
        allowedTools: ["WebSearch", "WebFetch"],
        permissionMode: "bypassPermissions",
        maxTurns: 8,
        model: "claude-sonnet-4-6",
      },
    });
    for await (const message of q) {
      const m = message as {
        type: string;
        message?: { content?: Array<{ type: string; text?: string }> };
        result?: string;
      };
      if (m.type === "assistant" && m.message?.content) {
        for (const c of m.message.content) {
          if (c.type === "text" && c.text) buf += c.text;
        }
      }
      if (m.type === "result" && m.result) buf = m.result;
    }
  } catch (e) {
    log(`cycle error: ${(e as Error).message}`);
    return 0;
  }

  const ideas = parseIdeas(buf);
  let added = 0;
  for (const i of ideas) {
    if (added >= MAX_IDEAS_PER_CYCLE) break;
    const hash = crypto.createHash("sha1").update(i.idea.toLowerCase()).digest("hex").slice(0, 16);
    if (seen.has(hash)) continue;
    if (i.sourceUrl && seen.has(i.sourceUrl)) continue;
    seen.add(hash);
    if (i.sourceUrl) seen.add(i.sourceUrl);
    const pillar: Pillar = (["ultron", "nova", "forge", "ares", "echo", "midas"] as Pillar[]).includes(i.pillar)
      ? i.pillar
      : classifyPillar(i.idea);
    appendIdea({
      pillar,
      idea: i.idea,
      sourceUrl: i.sourceUrl,
      rank: rankIdea(i.idea, pillar),
      tags: i.tags ?? [],
    });
    added += 1;
  }
  log(`cycle ok: ${added} new ideas appended`);
  return added;
}

function parseIdeas(raw: string): Array<{
  pillar: Pillar;
  idea: string;
  sourceUrl?: string;
  tags?: string[];
}> {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start < 0 || end <= start) return [];
  try {
    const arr = JSON.parse(raw.slice(start, end + 1)) as Array<{
      pillar?: string;
      idea?: string;
      sourceUrl?: string;
      tags?: string[];
    }>;
    return arr
      .filter((i) => typeof i.idea === "string" && i.idea.trim().length > 8)
      .map((i) => ({
        pillar: ((i.pillar as Pillar) ?? "any") as Pillar,
        idea: i.idea!.trim(),
        sourceUrl: i.sourceUrl,
        tags: i.tags,
      }));
  } catch {
    return [];
  }
}

async function mainLoop() {
  fs.writeFileSync(PID_FILE, String(process.pid));
  log(`worker start pid=${process.pid}`);

  let stopped = false;
  const onStop = () => {
    stopped = true;
    log("stop signal received");
  };
  process.on("message", (msg: unknown) => {
    if (msg && typeof msg === "object" && (msg as { type?: string }).type === "stop") onStop();
  });
  process.on("SIGTERM", onStop);
  process.on("SIGINT", onStop);

  const seen = loadSeen();

  // initial immediate cycle
  await runCycle(seen);

  while (!stopped) {
    const until = Date.now() + CYCLE_MS;
    while (Date.now() < until && !stopped) {
      await new Promise((r) => setTimeout(r, 5000));
    }
    if (stopped) break;
    try {
      await runCycle(seen);
    } catch (e) {
      log(`cycle crashed: ${(e as Error).message}`);
    }
  }

  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    // ignore
  }
  log("worker exit");
  process.exit(0);
}

if (process.env.CONDUCTOR_SCOUT === "1") {
  void mainLoop();
}

export const _internal = {
  parseIdeas,
  classifyPillar,
  rankIdea,
};
