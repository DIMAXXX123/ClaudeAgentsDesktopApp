import { describe, it, expect } from "vitest";
import { _internal } from "@/lib/scoutWorker";

const { parseIdeas, classifyPillar, rankIdea } = _internal;

describe("scoutWorker parseIdeas", () => {
  it("parses array of ideas", () => {
    const raw = `Here are ideas:
[
  { "pillar": "forge", "idea": "Add animated CosmosBackground with shader", "tags": ["three.js"] },
  { "pillar": "nova", "idea": "Semantic search via bge-small embeddings", "sourceUrl": "https://x" }
]
End.`;
    const out = parseIdeas(raw);
    expect(out).toHaveLength(2);
    expect(out[0].pillar).toBe("forge");
    expect(out[1].sourceUrl).toBe("https://x");
  });

  it("returns empty on junk", () => {
    expect(parseIdeas("no json here")).toEqual([]);
  });

  it("rejects short ideas", () => {
    const raw = `[{"idea":"too"}]`;
    expect(parseIdeas(raw)).toEqual([]);
  });
});

describe("classifyPillar / rankIdea", () => {
  it("classifies by keyword", () => {
    expect(classifyPillar("build a command palette with keyboard shortcuts")).toBe("ultron");
    expect(classifyPillar("embedding-based semantic search over chat")).toBe("nova");
    expect(classifyPillar("ThemeSwitcher with tailwind animations")).toBe("forge");
  });

  it("rank higher with more keyword hits", () => {
    const r1 = rankIdea("add a chart", "midas");
    const r2 = rankIdea("dashboard with cost tracking heatmap and sparkline", "midas");
    expect(r2).toBeGreaterThan(r1);
  });
});
