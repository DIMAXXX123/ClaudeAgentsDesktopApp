/**
 * Inline tests for memoryLoader — NOVA pillar.
 * Focuses on parseChatSnippets() which is pure (no I/O).
 * Run: npx vitest run lib/search/memoryLoader.test.ts
 */

import { describe, it, expect } from "vitest";
import { parseChatSnippets } from "./memoryLoader";

describe("parseChatSnippets", () => {
  it("returns empty array for non-array input", () => {
    expect(parseChatSnippets(null)).toEqual([]);
    expect(parseChatSnippets(undefined)).toEqual([]);
    expect(parseChatSnippets("string")).toEqual([]);
    expect(parseChatSnippets(42)).toEqual([]);
    expect(parseChatSnippets({})).toEqual([]);
  });

  it("returns empty array for empty array", () => {
    expect(parseChatSnippets([])).toEqual([]);
  });

  it("parses a valid snippet", () => {
    const raw = [
      {
        agentId: "echo",
        agentName: "Echo",
        role: "assistant",
        text: "Telegram bot is live",
        updatedAt: 1_700_000_000_000,
      },
    ];
    const result = parseChatSnippets(raw);
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("echo");
    expect(result[0].agentName).toBe("Echo");
    expect(result[0].role).toBe("assistant");
    expect(result[0].text).toBe("Telegram bot is live");
    expect(result[0].updatedAt).toBe(1_700_000_000_000);
  });

  it("defaults unknown role to 'assistant'", () => {
    const raw = [{ agentId: "x", agentName: "X", role: "system", text: "hi" }];
    const result = parseChatSnippets(raw);
    expect(result[0].role).toBe("assistant");
  });

  it("accepts role='user'", () => {
    const raw = [{ agentId: "x", agentName: "X", role: "user", text: "hi" }];
    expect(parseChatSnippets(raw)[0].role).toBe("user");
  });

  it("skips items missing required fields", () => {
    const raw = [
      { agentId: "ok", agentName: "OK", text: "hello" },   // valid
      { agentId: "bad" },                                    // missing agentName & text
      { agentName: "Bad", text: "no id" },                  // missing agentId
      null,
      42,
    ];
    const result = parseChatSnippets(raw);
    // only the first item is fully valid
    expect(result).toHaveLength(1);
    expect(result[0].agentId).toBe("ok");
  });

  it("defaults updatedAt to a recent number when missing", () => {
    const before = Date.now();
    const raw = [{ agentId: "x", agentName: "X", text: "hi" }];
    const result = parseChatSnippets(raw);
    const after = Date.now();
    expect(result[0].updatedAt).toBeGreaterThanOrEqual(before);
    expect(result[0].updatedAt).toBeLessThanOrEqual(after);
  });

  it("handles multiple valid snippets", () => {
    const raw = [
      { agentId: "nova",  agentName: "Nova",  role: "assistant", text: "Searching memory…", updatedAt: 1 },
      { agentId: "forge", agentName: "Forge", role: "user",      text: "Build the scaffold", updatedAt: 2 },
    ];
    const result = parseChatSnippets(raw);
    expect(result).toHaveLength(2);
    expect(result[1].agentId).toBe("forge");
  });

  it("truncates nothing — preserves full text", () => {
    const longText = "x".repeat(5000);
    const raw = [{ agentId: "a", agentName: "A", text: longText }];
    expect(parseChatSnippets(raw)[0].text).toBe(longText);
  });
});
