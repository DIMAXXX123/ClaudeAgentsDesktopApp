import { describe, expect, it } from "vitest";
import {
  buildGraph,
  detectType,
  deriveDescription,
  deriveName,
  extractIndexLinks,
  extractTags,
  parseFrontmatter,
  type RawMemoryFile,
} from "@/lib/memoryGalaxy";

describe("parseFrontmatter", () => {
  it("parses YAML frontmatter", () => {
    const { frontmatter, body } = parseFrontmatter("---\nname: X\ntype: user\n---\nhello");
    expect(frontmatter).toEqual({ name: "X", type: "user" });
    expect(body).toBe("hello");
  });

  it("returns empty frontmatter when missing", () => {
    const { frontmatter, body } = parseFrontmatter("no frontmatter here");
    expect(frontmatter).toEqual({});
    expect(body).toBe("no frontmatter here");
  });
});

describe("detectType", () => {
  it("returns index for MEMORY.md regardless of frontmatter", () => {
    expect(detectType("MEMORY.md", {})).toBe("index");
    expect(detectType("MEMORY.md", { type: "user" })).toBe("index");
  });

  it("prefers frontmatter type", () => {
    expect(detectType("random.md", { type: "feedback" })).toBe("feedback");
  });

  it("falls back to filename prefix", () => {
    expect(detectType("user_profile.md", {})).toBe("user");
    expect(detectType("reference_modly.md", {})).toBe("reference");
    expect(detectType("project_stack.md", {})).toBe("project");
    expect(detectType("feedback_core.md", {})).toBe("feedback");
  });

  it("returns unknown when nothing matches", () => {
    expect(detectType("random.md", {})).toBe("unknown");
  });
});

describe("extractTags", () => {
  it("finds vocab terms case-insensitively", () => {
    expect(extractTags("Using UEFN and Telegram with Supabase")).toEqual(["supabase", "telegram", "uefn"]);
  });

  it("returns empty array when nothing matches", () => {
    expect(extractTags("generic text")).toEqual([]);
  });

  it("deduplicates", () => {
    expect(extractTags("UEFN UEFN uefn")).toEqual(["uefn"]);
  });
});

describe("extractIndexLinks", () => {
  it("extracts markdown links to .md files", () => {
    const text = "- [Stack](project_stack.md) — stuff\n- [Other](reference_x.md) — more";
    expect(extractIndexLinks(text)).toEqual(["project_stack.md", "reference_x.md"]);
  });

  it("ignores http links and non-md", () => {
    const text = "[site](https://example.com) [img](x.png)";
    expect(extractIndexLinks(text)).toEqual([]);
  });
});

describe("deriveName / deriveDescription", () => {
  it("uses frontmatter name", () => {
    expect(deriveName("reference_x.md", { name: "Custom" })).toBe("Custom");
  });

  it("falls back to cleaned filename", () => {
    expect(deriveName("reference_core_rules.md", {})).toBe("core rules");
  });

  it("uses frontmatter description", () => {
    expect(deriveDescription({ description: "hi" }, "body")).toBe("hi");
  });

  it("falls back to first non-heading body line", () => {
    expect(deriveDescription({}, "# Title\n\nFirst paragraph")).toBe("First paragraph");
  });
});

describe("buildGraph", () => {
  const files: RawMemoryFile[] = [
    {
      filename: "MEMORY.md",
      content: "- [User](user_profile.md) — hi\n- [Ref](reference_modly.md) — modly\n- [Stack](project_stack.md) — uefn stack",
      sizeBytes: 100,
    },
    {
      filename: "user_profile.md",
      content: "---\nname: Dima\ntype: user\n---\nUEFN and Telegram user",
      sizeBytes: 50,
    },
    {
      filename: "reference_modly.md",
      content: "---\ntype: reference\n---\nmodly for UEFN with hunyuan and also project_stack.md reference",
      sizeBytes: 80,
    },
    {
      filename: "project_stack.md",
      content: "UEFN and Verse and Telegram Python stack",
      sizeBytes: 60,
    },
  ];

  const graph = buildGraph(files);

  it("creates one node per file", () => {
    expect(graph.nodes).toHaveLength(4);
  });

  it("detects types correctly", () => {
    const types = Object.fromEntries(graph.nodes.map((n) => [n.id, n.type]));
    expect(types["MEMORY.md"]).toBe("index");
    expect(types["user_profile.md"]).toBe("user");
    expect(types["reference_modly.md"]).toBe("reference");
    expect(types["project_stack.md"]).toBe("project");
  });

  it("creates index edges from MEMORY.md to each linked file", () => {
    const indexEdges = graph.edges.filter((e) => e.kind === "index");
    expect(indexEdges).toHaveLength(3);
    expect(indexEdges.every((e) => e.source === "MEMORY.md" || e.target === "MEMORY.md")).toBe(true);
  });

  it("creates cross-ref edges when one file mentions another filename", () => {
    const crossRefs = graph.edges.filter((e) => e.kind === "cross-ref");
    expect(crossRefs.some((e) => [e.source, e.target].sort().join("|") === "project_stack.md|reference_modly.md")).toBe(true);
  });

  it("creates tag edges when files share 2+ tags", () => {
    const tagEdges = graph.edges.filter((e) => e.kind === "tag");
    expect(tagEdges.length).toBeGreaterThan(0);
  });

  it("computes degree equal to number of unique edges touching each node", () => {
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    const expected: Record<string, number> = {};
    for (const e of graph.edges) {
      expected[e.source] = (expected[e.source] ?? 0) + 1;
      expected[e.target] = (expected[e.target] ?? 0) + 1;
    }
    for (const id of Object.keys(expected)) {
      expect(byId[id].degree).toBe(expected[id]);
    }
  });

  it("does not create self-loops", () => {
    expect(graph.edges.every((e) => e.source !== e.target)).toBe(true);
  });

  it("does not create duplicate same-kind edges", () => {
    const keys = graph.edges.map((e) => `${e.source}|${e.target}|${e.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
