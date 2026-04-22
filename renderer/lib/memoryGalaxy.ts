export type NodeType =
  | "index"
  | "user"
  | "feedback"
  | "project"
  | "reference"
  | "skill"
  | "agent"
  | "command"
  | "rule"
  | "hook"
  | "plan"
  | "output-style"
  | "claude-md"
  | "plugin-skill"
  | "plugin-command"
  | "plugin-agent"
  | "unknown";

export type MemoryNode = {
  id: string;
  name: string;
  type: NodeType;
  description: string;
  tags: string[];
  sizeBytes: number;
  degree: number;
};

export type EdgeKind = "index" | "cross-ref" | "tag" | "cluster";

export type MemoryEdge = {
  source: string;
  target: string;
  kind: EdgeKind;
  weight: number;
};

export type RawMemoryFile = {
  filename: string;
  content: string;
  sizeBytes: number;
  sourceLabel?: string;
  displayName?: string;
};

export type MemoryGraph = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
};

const TAG_VOCAB = [
  "uefn",
  "verse",
  "telegram",
  "obsidian",
  "supabase",
  "nextjs",
  "claude",
  "python",
  "modly",
  "hunyuan",
  "fortnite",
  "mcp",
  "ralph",
  "discover",
  "voice",
  "hooks",
  "mdk",
  "cache",
  "brainrot",
  "rvb",
  "git",
  "testing",
  "debug",
  "plan",
  "brainstorm",
  "agent",
  "skill",
  "memory",
  "security",
  "vercel",
  "react",
  "typescript",
  "tailwind",
  "api",
  "auth",
  "rls",
  "migration",
  "canvas",
  "graph",
  "layout",
  "discord",
  "notion",
  "openai",
  "anthropic",
  "bun",
  "node",
  "vitest",
  "commit",
  "review",
  "refactor",
];

const SOURCE_LABEL_TO_TYPE: Record<string, NodeType> = {
  memory: "reference",
  "claude-md-global": "claude-md",
  "claude-md-project": "claude-md",
  skill: "skill",
  agent: "agent",
  command: "command",
  rule: "rule",
  hook: "hook",
  plan: "plan",
  "output-style": "output-style",
  "plugin-skill": "plugin-skill",
  "plugin-command": "plugin-command",
  "plugin-agent": "plugin-agent",
};

export function detectType(
  filename: string,
  frontmatter: Record<string, string>,
  sourceLabel?: string,
): NodeType {
  const lower = filename.toLowerCase();
  if (lower === "memory.md" || lower.endsWith("/memory.md")) return "index";

  const declared = frontmatter.type?.toLowerCase();
  const declaredValid =
    declared === "user" || declared === "feedback" || declared === "project" || declared === "reference"
      ? (declared as NodeType)
      : null;

  const base = lower.split("/").pop() ?? lower;
  let prefixType: NodeType | null = null;
  if (base.startsWith("user_")) prefixType = "user";
  else if (base.startsWith("feedback_")) prefixType = "feedback";
  else if (base.startsWith("project_")) prefixType = "project";
  else if (base.startsWith("reference_")) prefixType = "reference";

  if (sourceLabel === "memory") {
    return declaredValid ?? prefixType ?? "reference";
  }
  if (sourceLabel && SOURCE_LABEL_TO_TYPE[sourceLabel]) return SOURCE_LABEL_TO_TYPE[sourceLabel];

  return declaredValid ?? prefixType ?? "unknown";
}

export function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key) frontmatter[key] = value;
  }
  return { frontmatter, body: match[2] };
}

export function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const found = new Set<string>();
  for (const tag of TAG_VOCAB) {
    const re = new RegExp(`(^|[^a-z0-9])${tag}([^a-z0-9]|$)`, "i");
    if (re.test(lower)) found.add(tag);
  }
  return [...found].sort();
}

export function deriveName(
  filename: string,
  frontmatter: Record<string, string>,
  displayName?: string,
): string {
  if (frontmatter.name) return frontmatter.name;
  if (displayName) return displayName;
  const lower = filename.toLowerCase();
  if (lower === "memory.md") return "INDEX";
  const base = filename.split("/").pop() ?? filename;
  return base
    .replace(/\.(md|sh|ps1|mjs|js)$/, "")
    .replace(/^(user|feedback|project|reference)_/i, "")
    .replace(/_/g, " ");
}

export function deriveDescription(frontmatter: Record<string, string>, body: string): string {
  if (frontmatter.description) return frontmatter.description;
  const firstLine = body
    .split(/\r?\n/)
    .map((s) => s.trim())
    .find((s) => s.length > 0 && !s.startsWith("#"));
  return firstLine?.slice(0, 240) ?? "";
}

export function extractIndexLinks(content: string): string[] {
  const matches = content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g);
  const out = new Set<string>();
  for (const m of matches) {
    const target = m[1].trim();
    if (target && !target.startsWith("http")) out.add(target);
  }
  return [...out];
}

type ParsedFile = {
  filename: string;
  sizeBytes: number;
  sourceLabel?: string;
  displayName?: string;
  frontmatter: Record<string, string>;
  body: string;
  content: string;
};

export function buildGraph(files: RawMemoryFile[]): MemoryGraph {
  const parsed: ParsedFile[] = files.map((f) => {
    const { frontmatter, body } = parseFrontmatter(f.content);
    return {
      filename: f.filename,
      sizeBytes: f.sizeBytes,
      sourceLabel: f.sourceLabel,
      displayName: f.displayName,
      frontmatter,
      body,
      content: f.content,
    };
  });

  const nodes: MemoryNode[] = parsed.map((p) => ({
    id: p.filename,
    name: deriveName(p.filename, p.frontmatter, p.displayName),
    type: detectType(p.filename, p.frontmatter, p.sourceLabel),
    description: deriveDescription(p.frontmatter, p.body),
    tags: extractTags(p.body),
    sizeBytes: p.sizeBytes,
    degree: 0,
  }));

  const idSet = new Set(nodes.map((n) => n.id));
  const edges: MemoryEdge[] = [];
  const seen = new Set<string>();

  const addEdge = (a: string, b: string, kind: EdgeKind, weight: number) => {
    if (a === b || !idSet.has(a) || !idSet.has(b)) return;
    const [s, t] = a < b ? [a, b] : [b, a];
    const key = `${s}|${t}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ source: s, target: t, kind, weight });
  };

  const byBasename = new Map<string, string[]>();
  for (const p of parsed) {
    const base = (p.filename.split("/").pop() ?? p.filename).toLowerCase();
    if (!byBasename.has(base)) byBasename.set(base, []);
    byBasename.get(base)!.push(p.filename);
  }

  const indexFiles = parsed.filter((p) => {
    const base = (p.filename.split("/").pop() ?? p.filename).toLowerCase();
    return base === "memory.md";
  });
  for (const idx of indexFiles) {
    for (const link of extractIndexLinks(idx.content)) {
      const base = link.toLowerCase();
      const candidates = byBasename.get(base) ?? [];
      for (const candidate of candidates) addEdge(idx.filename, candidate, "index", 2);
    }
  }

  const MAX_CROSS_REF_FILES = 300;
  const crossRefPool =
    parsed.length <= MAX_CROSS_REF_FILES
      ? parsed
      : parsed.filter((p) => !p.sourceLabel || p.sourceLabel === "memory" || p.sourceLabel === "claude-md-global" || p.sourceLabel === "claude-md-project");
  for (let i = 0; i < crossRefPool.length; i++) {
    for (let j = i + 1; j < crossRefPool.length; j++) {
      const a = crossRefPool[i];
      const b = crossRefPool[j];
      const aBase = (a.filename.split("/").pop() ?? a.filename).toLowerCase();
      const bBase = (b.filename.split("/").pop() ?? b.filename).toLowerCase();
      if (aBase === "memory.md" || bBase === "memory.md") continue;
      const aLower = a.body.toLowerCase();
      const bLower = b.body.toLowerCase();
      if (aLower.includes(bBase) || bLower.includes(aBase)) {
        addEdge(a.filename, b.filename, "cross-ref", 1.5);
      }
    }
  }

  const nodeTagSets = nodes.map((n) => new Set(n.tags));
  const MAX_TAG_EDGES = 3000;
  let tagEdgeCount = 0;
  const buckets = new Map<string, number[]>();
  for (let i = 0; i < nodes.length; i++) {
    for (const t of nodeTagSets[i]) {
      if (!buckets.has(t)) buckets.set(t, []);
      buckets.get(t)!.push(i);
    }
  }
  const candidatePairs = new Map<string, number>();
  for (const indices of buckets.values()) {
    if (indices.length > 80) continue;
    for (let i = 0; i < indices.length; i++) {
      for (let j = i + 1; j < indices.length; j++) {
        const a = indices[i];
        const b = indices[j];
        const key = `${a}|${b}`;
        candidatePairs.set(key, (candidatePairs.get(key) ?? 0) + 1);
      }
    }
  }
  const pairs = [...candidatePairs.entries()]
    .filter(([, shared]) => shared >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_TAG_EDGES);
  for (const [key, shared] of pairs) {
    const [aStr, bStr] = key.split("|");
    const a = Number(aStr);
    const b = Number(bStr);
    addEdge(nodes[a].id, nodes[b].id, "tag", Math.min(1 + shared * 0.25, 2));
    tagEdgeCount++;
    if (tagEdgeCount >= MAX_TAG_EDGES) break;
  }

  const claudeMd = nodes.find((n) => n.type === "claude-md" && n.id.startsWith("claude-md/"));
  if (claudeMd) {
    const memoryIndex = nodes.find((n) => n.type === "index");
    if (memoryIndex) addEdge(claudeMd.id, memoryIndex.id, "cluster", 3);
  }

  const degreeMap = new Map<string, number>();
  for (const e of edges) {
    degreeMap.set(e.source, (degreeMap.get(e.source) ?? 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) ?? 0) + 1);
  }
  for (const n of nodes) n.degree = degreeMap.get(n.id) ?? 0;

  return { nodes, edges };
}

export const NODE_COLOR: Record<NodeType, string> = {
  index: "#f8fafc",
  user: "#a78bfa",
  feedback: "#fb923c",
  project: "#4ade80",
  reference: "#22d3ee",
  skill: "#f472b6",
  agent: "#facc15",
  command: "#60a5fa",
  rule: "#f87171",
  hook: "#c084fc",
  plan: "#34d399",
  "output-style": "#94a3b8",
  "claude-md": "#ffffff",
  "plugin-skill": "#ec4899",
  "plugin-command": "#38bdf8",
  "plugin-agent": "#fcd34d",
  unknown: "#64748b",
};
