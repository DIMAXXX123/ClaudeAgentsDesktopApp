import { describe, it, expect, beforeEach } from "vitest";
import fc from "fast-check";
import { loadChat, saveChat, clearChat, listChatSummaries } from "@/lib/chatStore";
import type { ChatMsg } from "@/lib/useAgentChat";

beforeEach(() => {
  localStorage.clear();
});

const msgArb: fc.Arbitrary<ChatMsg> = fc.oneof(
  fc.record({
    role: fc.constant("user" as const),
    text: fc.string({ maxLength: 200 }),
  }),
  fc.record({
    role: fc.constant("assistant" as const),
    text: fc.string({ maxLength: 200 }),
    tools: fc.array(
      fc.record({
        id: fc.uuid(),
        name: fc.constantFrom("Bash", "Read", "Write", "Grep", "Glob", "WebFetch"),
        input: fc.object(),
        output: fc.option(fc.string({ maxLength: 100 }), { nil: undefined }),
        isError: fc.option(fc.boolean(), { nil: undefined }),
      }),
      { maxLength: 5 },
    ),
  }),
);

describe("chatStore", () => {
  it("returns empty for missing agent", () => {
    const c = loadChat("ghost");
    expect(c.messages).toEqual([]);
    expect(c.sessionId).toBeUndefined();
  });

  it("roundtrip save → load preserves messages (up to JSON normalization)", () => {
    const normalize = <T>(v: T): T => JSON.parse(JSON.stringify(v));
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(msgArb, { maxLength: 20 }),
        fc.option(fc.uuid(), { nil: undefined }),
        (agentId, messages, sessionId) => {
          saveChat(agentId, { messages, sessionId });
          const loaded = loadChat(agentId);
          expect(loaded.messages).toEqual(normalize(messages));
          expect(loaded.sessionId).toEqual(sessionId);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("clear wipes both chat and session", () => {
    saveChat("ultron", { messages: [{ role: "user", text: "hi" }], sessionId: "abc" });
    clearChat("ultron");
    const c = loadChat("ultron");
    expect(c.messages).toEqual([]);
    expect(c.sessionId).toBeUndefined();
  });

  it("survives corrupted localStorage entry", () => {
    localStorage.setItem("ultronos.chat.v1:ultron", "{not json");
    const c = loadChat("ultron");
    expect(c.messages).toEqual([]);
  });

  it("rejects invalid message shapes without crashing", () => {
    localStorage.setItem(
      "ultronos.chat.v1:ultron",
      JSON.stringify({ messages: [{ role: "alien" }, null, { role: "user" }], updatedAt: 0 }),
    );
    const c = loadChat("ultron");
    expect(c.messages).toEqual([]);
  });

  it("listChatSummaries reports counts correctly", () => {
    saveChat("a", { messages: [{ role: "user", text: "x" }] });
    saveChat("b", {
      messages: [
        { role: "user", text: "x" },
        { role: "assistant", text: "y", tools: [] },
      ],
    });
    const sums = listChatSummaries(["a", "b", "c"]);
    expect(sums.find((s) => s.agentId === "a")?.count).toBe(1);
    expect(sums.find((s) => s.agentId === "b")?.count).toBe(2);
    expect(sums.find((s) => s.agentId === "c")?.count).toBe(0);
  });
});
