import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { buildGraph, type RawMemoryFile } from "@/lib/memoryGalaxy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HOME = os.homedir();

type SourceSpec = {
  label: string;
  dir: string;
  recursive: boolean;
  extensions: string[];
  maxDepth: number;
  idPrefix: string;
};

const SOURCES: SourceSpec[] = [
  { label: "memory", dir: path.join(HOME, ".claude/projects/C--WINDOWS-system32/memory"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "memory/" },
  { label: "claude-md-global", dir: path.join(HOME, ".claude"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "claude-md/" },
  { label: "claude-md-project", dir: path.join(HOME, "Documents/fortnite-analytics"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "claude-md-fa/" },
  { label: "skill", dir: path.join(HOME, ".claude/skills"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "skill/" },
  { label: "agent", dir: path.join(HOME, ".claude/agents"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "agent/" },
  { label: "command", dir: path.join(HOME, ".claude/commands"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "cmd/" },
  { label: "rule", dir: path.join(HOME, ".claude/rules"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "rule/" },
  { label: "plan", dir: path.join(HOME, ".claude/plans"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "plan/" },
  { label: "output-style", dir: path.join(HOME, ".claude/output-styles"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "style/" },
  { label: "hook", dir: path.join(HOME, ".claude/hooks"), recursive: false, extensions: [".sh", ".ps1", ".js", ".mjs"], maxDepth: 1, idPrefix: "hook/" },
  { label: "plugin-skill", dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/skills"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "pskill/sp/" },
  { label: "plugin-skill", dir: path.join(HOME, ".claude/plugins/marketplaces/claude-plugins-official/plugins"), recursive: true, extensions: [".md"], maxDepth: 4, idPrefix: "pskill/off/" },
  { label: "plugin-command", dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/commands"), recursive: true, extensions: [".md"], maxDepth: 2, idPrefix: "pcmd/sp/" },
  { label: "plugin-agent", dir: path.join(HOME, ".claude/plugins/marketplaces/superpowers-dev/agents"), recursive: false, extensions: [".md"], maxDepth: 1, idPrefix: "pagent/sp/" },
];

const MAX_BYTES = 32 * 1024;
const MAX_FILES = 4000;

async function walkDir(dir: string, depth: number, maxDepth: number, exts: string[]): Promise<string[]> {
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
      if (depth < maxDepth) {
        const sub = await walkDir(full, depth + 1, maxDepth, exts);
        out.push(...sub);
      }
    } else if (e.isFile()) {
      const lower = e.name.toLowerCase();
      if (exts.some((x) => lower.endsWith(x))) out.push(full);
    }
  }
  return out;
}

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
  const safePaths = paths.filter((p) => {
    const resolved = path.resolve(p);
    const rel = path.relative(baseDir, resolved);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
  const files: RawMemoryFile[] = [];
  for (const full of safePaths) {
    try {
      const stat = await fs.stat(full);
      if (stat.size > MAX_BYTES * 4) continue;
      let content = await fs.readFile(full, "utf-8");
      if (content.length > MAX_BYTES) content = content.slice(0, MAX_BYTES);
      const rel = path.relative(baseDir, full).replace(/\\/g, "/");
      const id = `${spec.idPrefix}${rel}`;
      files.push({
        filename: id,
        content,
        sizeBytes: stat.size,
        sourceLabel: spec.label,
        displayName: rel.replace(/\.(md|sh|ps1|mjs|js)$/, "").replace(/\/SKILL$/, ""),
      });
    } catch {
      continue;
    }
  }
  return files;
}

export async function GET() {
  try {
    const buckets = await Promise.all(SOURCES.map(collectFromSource));
    let all = buckets.flat();
    if (all.length > MAX_FILES) all = all.slice(0, MAX_FILES);
    const graph = buildGraph(all);
    return NextResponse.json({
      ok: true,
      graph,
      count: all.length,
      buckets: SOURCES.map((s, i) => ({ label: s.label, dir: s.dir, count: buckets[i].length })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
