import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { reduceSSE, type ChatMsg, type SSEEvent, type AgentStatus } from "@/lib/useAgentChat";

function initialState(prompt = "hi"): {
  messages: ChatMsg[];
  status: AgentStatus;
  sessionId?: string;
} {
  return {
    messages: [
      { role: "user", text: prompt },
      { role: "assistant", text: "", tools: [] },
    ],
    status: "working",
    sessionId: undefined,
  };
}

const eventArb: fc.Arbitrary<SSEEvent> = fc.oneof(
  fc.record({
    type: fc.constant("assistant_text" as const),
    text: fc.string({ maxLength: 50 }),
  }),
  fc.record({
    type: fc.constant("tool_use" as const),
    id: fc.uuid(),
    name: fc.constantFrom("Bash", "Read", "Write", "Grep"),
    input: fc.object(),
  }),
  fc.record({
    type: fc.constant("tool_result" as const),
    id: fc.uuid(),
    output: fc.string({ maxLength: 80 }),
    isError: fc.boolean(),
  }),
  fc.record({
    type: fc.constant("done" as const),
    sessionId: fc.option(fc.uuid(), { nil: undefined }),
    error: fc.option(fc.string(), { nil: undefined }),
  }),
  fc.record({
    type: fc.constant("error" as const),
    message: fc.string(),
  }),
);

describe("reduceSSE", () => {
  it("appends assistant text to last assistant message", () => {
    const s0 = initialState();
    const s1 = reduceSSE(s0, { type: "assistant_text", text: "hello " });
    const s2 = reduceSSE(s1, { type: "assistant_text", text: "world" });
    const last = s2.messages[s2.messages.length - 1];
    expect(last.role).toBe("assistant");
    if (last.role === "assistant") expect(last.text).toBe("hello world");
  });

  it("appends tool_use to last assistant tools array", () => {
    const s = reduceSSE(initialState(), {
      type: "tool_use",
      id: "t1",
      name: "Bash",
      input: { command: "ls" },
    });
    const last = s.messages[s.messages.length - 1];
    if (last.role === "assistant") {
      expect(last.tools.length).toBe(1);
      expect(last.tools[0].name).toBe("Bash");
    }
  });

  it("tool_result matches by id and writes output/isError", () => {
    let s = reduceSSE(initialState(), {
      type: "tool_use",
      id: "t1",
      name: "Read",
      input: { file_path: "/x" },
    });
    s = reduceSSE(s, { type: "tool_result", id: "t1", output: "hello", isError: false });
    const last = s.messages[s.messages.length - 1];
    if (last.role === "assistant") {
      expect(last.tools[0].output).toBe("hello");
      expect(last.tools[0].isError).toBe(false);
    }
  });

  it("tool_result with unknown id is no-op", () => {
    const s0 = initialState();
    const s1 = reduceSSE(s0, { type: "tool_result", id: "missing", output: "x" });
    expect(s1.messages).toEqual(s0.messages);
  });

  it("done sets sessionId and status=idle on success", () => {
    const s = reduceSSE(initialState(), { type: "done", sessionId: "abc" });
    expect(s.sessionId).toBe("abc");
    expect(s.status).toBe("idle");
  });

  it("done with error sets status=error", () => {
    const s = reduceSSE(initialState(), { type: "done", sessionId: "abc", error: "fail" });
    expect(s.status).toBe("error");
  });

  it("error appends warning to last assistant", () => {
    const s = reduceSSE(initialState(), { type: "error", message: "boom" });
    const last = s.messages[s.messages.length - 1];
    if (last.role === "assistant") {
      expect(last.text).toContain("boom");
    }
    expect(s.status).toBe("error");
  });

  it("fuzz: 2000 random event sequences never throw and preserve invariants", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { minLength: 1, maxLength: 30 }), (events) => {
        let state = initialState();
        for (const ev of events) {
          state = reduceSSE(state, ev);
          // Invariants:
          // 1. messages[0] is the user message, unchanged
          expect(state.messages[0]).toEqual({ role: "user", text: "hi" });
          // 2. no message is malformed
          for (const m of state.messages) {
            if (m.role === "assistant") {
              expect(typeof m.text).toBe("string");
              expect(Array.isArray(m.tools)).toBe(true);
              for (const t of m.tools) {
                expect(typeof t.id).toBe("string");
                expect(typeof t.name).toBe("string");
              }
            }
          }
          // 3. status is one of the allowed values
          expect(["idle", "working", "error"]).toContain(state.status);
        }
      }),
      { numRuns: 2000 },
    );
  });
});
