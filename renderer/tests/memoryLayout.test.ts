import { describe, expect, it } from "vitest";
import { buildGraph, type RawMemoryFile } from "@/lib/memoryGalaxy";
import { initLayout, simulateLayout } from "@/lib/memoryLayout";

const files: RawMemoryFile[] = [
  { filename: "MEMORY.md", content: "- [A](a.md)\n- [B](b.md)\n- [C](c.md)", sizeBytes: 50 },
  { filename: "a.md", content: "---\ntype: user\n---\ncontent A with UEFN Telegram", sizeBytes: 40 },
  { filename: "b.md", content: "---\ntype: reference\n---\ncontent B with UEFN Telegram", sizeBytes: 40 },
  { filename: "c.md", content: "---\ntype: project\n---\ncontent C mentions a.md", sizeBytes: 40 },
];

const graph = buildGraph(files);
const opts = { width: 800, height: 600, seed: 42 };

describe("initLayout", () => {
  it("produces a node per graph node", () => {
    const nodes = initLayout(graph, opts);
    expect(nodes).toHaveLength(graph.nodes.length);
  });

  it("pins the index node at center", () => {
    const nodes = initLayout(graph, opts);
    const index = nodes.find((n) => n.id === "MEMORY.md")!;
    expect(index.pinned).toBe(true);
    expect(index.x).toBe(opts.width / 2);
    expect(index.y).toBe(opts.height / 2);
  });

  it("is deterministic for same seed", () => {
    const a = initLayout(graph, opts);
    const b = initLayout(graph, opts);
    expect(a.map((n) => n.x)).toEqual(b.map((n) => n.x));
    expect(a.map((n) => n.y)).toEqual(b.map((n) => n.y));
  });
});

describe("simulateLayout", () => {
  it("keeps all nodes inside bounds", () => {
    const nodes = simulateLayout(graph, { ...opts, iterations: 120 });
    for (const n of nodes) {
      expect(n.x).toBeGreaterThan(0);
      expect(n.x).toBeLessThan(opts.width);
      expect(n.y).toBeGreaterThan(0);
      expect(n.y).toBeLessThan(opts.height);
    }
  });

  it("keeps the index node pinned at center after sim", () => {
    const nodes = simulateLayout(graph, { ...opts, iterations: 120 });
    const index = nodes.find((n) => n.id === "MEMORY.md")!;
    expect(index.x).toBe(opts.width / 2);
    expect(index.y).toBe(opts.height / 2);
  });

  it("produces finite coordinates", () => {
    const nodes = simulateLayout(graph, { ...opts, iterations: 120 });
    for (const n of nodes) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    }
  });

  it("is deterministic for same seed", () => {
    const a = simulateLayout(graph, { ...opts, iterations: 60 });
    const b = simulateLayout(graph, { ...opts, iterations: 60 });
    expect(a.map((n) => `${n.x.toFixed(3)},${n.y.toFixed(3)}`)).toEqual(
      b.map((n) => `${n.x.toFixed(3)},${n.y.toFixed(3)}`),
    );
  });
});
