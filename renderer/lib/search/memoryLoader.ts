/**
 * memoryLoader.ts — NOVA pillar (lib/search/)
 *
 * Server-side: walks the Claude memory filesystem and returns
 * { nodes, chats } ready for nlSearch().
 *
 * Extracted from app/api/memory-galaxy/route.ts pattern so the
 * search API can load data without duplicating walk logic.
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { buildGraph, type MemoryNode, type RawMemoryFile } from "@/lib/memoryGalaxy";
import type { ChatSnippet } from "./nlSearch";

// ── Source definitions (mirrors memory-galaxy route) ─────────────────────────

type SourceSpec = {
  label: string;
  dir: string;
  recursive: boolean;
  extensions: string[];
  maxDepth: number;
  idPrefix: string;
};

const HOME = os.homedir();

const SOURCES: SourceSpec[] = [
  { label: "memory",           dir: path.join(HOME, ".claude/projects/C--WINDOWS-system32/memory"), recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "memory/" },
  { label: "claude-md-global", dir: path.join(HOME, ".claude"),                                     recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "claude-md/" },
  { label: "claude-md-fa",     dir: path.join(HOME, "Documents/fortnite-analytics"),                recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "claude-md-fa/" },
  { label: "skill",            dir: path.join(HOME, ".claude/skills"),                              recursive: true,  extensions: [".md"],                        maxDepth: 2, idPrefix: "skill/" },
  { label: "agent",            dir: path.join(HOME, ".claude/agents"),                              recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "agent/" },
  { label: "command",          dir: path.join(HOME, ".claude/commands"),                            recursive: true,  extensions: [".md"],                        maxDepth: 2, idPrefix: "cmd/" },
  { label: "rule",             dir: path.join(HOME, ".claude/rules"),                               recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "rule/" },
  { label: "plan",             dir: path.join(HOME, ".claude/plans"),                               recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "plan/" },
  { label: "output-style",     dir: path.join(HOME, ".claude/output-styles"),                       recursive: false, extensions: [".md"],                        maxDepth: 1, idPrefix: "style/" },
  { label: "hook",             dir: path.join(HOME, ".claude/hooks"),                               recursive: false, extensions: [".sh", ".ps1", ".js", ".mjs"], maxDepth: 1, idPrefix: "hook/" },
  { label: "plugin-skill",     dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/skills"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "pskill/sp/" },
  { label: "plugin-skill",     dir: path.join(HOME, ".claude/plugins/marketplaces/claude-plugins-official/plugins"), recursive: true, extensions: [".md"], maxDepth: 4, idPrefix: "pskill/off/" },
  { label: "plugin-command",   dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/commands"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "pcmd/sp/" },
  { label: "plugin-agent",     dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/agents"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "pagent/sp/" },
];

const MAX_BYTES_PER_FILE = 32 * 1024;
const MAX_FILES_TOTAL    = 4_000;

// ── Walk helper ───────────────────────────────────────────────────────────────

async function walkDir(
  dir: string,
  depth: number,
  maxDepth: number,
  exts: string[],
): Promise<string[]> {
  const out: string[] = [];
  if (depth > maxDepth) return out;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (depth < maxDepth) out.push(...await walkDir(full, depth + 1, maxDepth, exts));
    } else if (e.isFile()) {
      if (exts.some((x) => e.name.toLowerCase().endsWith(x))) out.push(full);
    }
  }
  return out;
}

// ── Source collector ──────────────────────────────────────────────────────────

async function collectFromSource(spec: SourceSpec): Promise<RawMemoryFile[]> {
  const baseDir = path.resolve(spec.dir);
  let paths: string[];
  try {
    if (spec.recursive) {
      paths = await walkDir(baseDir, 0, spec.maxDepth, spec.extensions);
    } else {
      const entries = await fs.readdir(baseDir, { withFileTypes: true });
      paths = entries
        .filter((e) => e.isFile() && spec.extensions.some((x) => e.name.toLowerCase().endsWith(x)))
        .map((e) => path.join(baseDir, e.name));
    }
  } catch {
    return [];
  }
  // Path-traversal guard
  const safePaths = paths.filter((p) => path.resolve(p).startsWith(baseDir));
  const files: RawMemoryFile[] = [];
  for (const full of safePaths) {
    try {
      const stat = await fs.stat(full);
      if (stat.size > MAX_BYTES_PER_FILE * 4) continue;
      let content = await fs.readFile(full, "utf-8");
      if (content.length > MAX_BYTES_PER_FILE) content = content.slice(0, MAX_BYTES_PER_FILE);
      const rel = path.relative(baseDir, full).replace(/\\/g, "/");
      files.push({
        filename: `${spec.idPrefix}${rel}`,
        content,
        sizeBytes: stat.size,
        sourceLabel: spec.label,
        displayName: rel.replace(/\.(md|sh|ps1|mjs|js)$/, ""),
      });
    } catch {
      continue;
    }
  }
  return files;
}

// ── Public API ────────────────────────────────────────────────────────────────

export type LoadedMemory = {
  nodes: MemoryNode[];
  /** File count before graph build */
  rawCount: number;
  /** Label → file count breakdown */
  buckets: Array<{ label: string; count: number }>;
};

/**
 * Loads all memory files from disk, builds the graph, and returns flat node list.
 * Pure server-side — never call from "use client" code.
 */
export async function loadMemoryNodes(): Promise<LoadedMemory> {
  const buckets = await Promise.all(SOURCES.map(collectFromSource));
  let all = buckets.flat();
  if (all.length > MAX_FILES_TOTAL) all = all.slice(0, MAX_FILES_TOTAL);

  const graph = buildGraph(all);

  return {
    nodes: graph.nodes,
    rawCount: all.length,
    buckets: SOURCES.map((s, i) => ({ label: s.label, count: buckets[i].length })),
  };
}

// ── Chat extractor (localStorage → ChatSnippet[]) ───────────────────────────

/**
 * Converts a client-supplied raw chat array into typed ChatSnippet[].
 * Used by the POST route where the browser sends its localStorage chats.
 */
export function parseChatSnippets(raw: unknown): ChatSnippet[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatSnippet[] = [];
  for (const item of raw) {
    if (
      typeof item === "object" &&
      item !== null &&
      typeof (item as Record<string, unknown>).agentId === "string" &&
      typeof (item as Record<string, unknown>).agentName === "string" &&
      typeof (item as Record<string, unknown>).text === "string"
    ) {
      const r = item as Record<string, unknown>;
      out.push({
        agentId:   r.agentId as string,
        agentName: r.agentName as string,
        role:      (r.role === "user" ? "user" : "assistant") as "user" | "assistant",
        text:      r.text as string,
        updatedAt: typeof r.updatedAt === "number" ? r.updatedAt : Date.now(),
      });
    }
  }
  return out;
}
