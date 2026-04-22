/**
 * Property-based tests for lib/search/memoryLoader.ts
 * Focuses on parseChatSnippets() — pure function, no I/O, fast-check safe.
 * Covers boundary edge cases: random objects, adversarial fields, role coercion,
 * updatedAt type coercion, large arrays, injection strings, unicode.
 */
import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { parseChatSnippets } from "@/lib/search/memoryLoader";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const validRole = fc.constantFrom("user", "assistant");
const invalidRole = fc.oneof(
  fc.string(),
  fc.constant("system"),
  fc.constant("ADMIN"),
  fc.constant(""),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
);

/** A fully valid snippet object */
const validSnippetArb = fc.record({
  agentId:   fc.string({ minLength: 1, maxLength: 50 }),
  agentName: fc.string({ minLength: 1, maxLength: 80 }),
  role:      validRole,
  text:      fc.string({ minLength: 0, maxLength: 2000 }),
  updatedAt: fc.nat({ max: 9_999_999_999_999 }),
});

/** An invalid snippet missing at least one required string field */
const invalidSnippetArb = fc.oneof(
  fc.record({ agentId: fc.string(), role: validRole, text: fc.string() }),  // missing agentName
  fc.record({ agentName: fc.string(), role: validRole, text: fc.string() }), // missing agentId
  fc.record({ agentId: fc.string(), agentName: fc.string(), role: validRole }), // missing text
  fc.record({ agentId: fc.integer(), agentName: fc.string(), text: fc.string() }), // agentId not string
  fc.record({ agentId: fc.string(), agentName: fc.integer(), text: fc.string() }), // agentName not string
  fc.record({ agentId: fc.string(), agentName: fc.string(), text: fc.integer() }), // text not string
  fc.constant(null),
  fc.constant(42),
  fc.constant("bare string"),
  fc.constant([]),
);

// ─── Output type invariants ────────────────────────────────────────────────

describe("parseChatSnippets — type invariants", () => {
  it("always returns an array", () => {
    fc.assert(
      fc.property(fc.anything(), (input) => {
        const r = parseChatSnippets(input);
        expect(Array.isArray(r)).toBe(true);
      }),
      { numRuns: 1000 },
    );
  });

  it("every output item has agentId as a string", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        for (const item of r) {
          expect(typeof item.agentId).toBe("string");
        }
      }),
      { numRuns: 500 },
    );
  });

  it("every output item has agentName as a string", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        for (const item of r) {
          expect(typeof item.agentName).toBe("string");
        }
      }),
      { numRuns: 500 },
    );
  });

  it("every output item has text as a string", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        for (const item of r) {
          expect(typeof item.text).toBe("string");
        }
      }),
      { numRuns: 500 },
    );
  });

  it("every output item role is exactly 'user' or 'assistant'", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        for (const item of r) {
          expect(["user", "assistant"]).toContain(item.role);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("every output item updatedAt is a finite number", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        for (const item of r) {
          expect(typeof item.updatedAt).toBe("number");
          expect(Number.isFinite(item.updatedAt)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});

// ─── Cardinality invariants ────────────────────────────────────────────────

describe("parseChatSnippets — cardinality invariants", () => {
  it("output length never exceeds input array length", () => {
    fc.assert(
      fc.property(fc.array(fc.anything(), { maxLength: 50 }), (arr) => {
        const r = parseChatSnippets(arr);
        expect(r.length).toBeLessThanOrEqual(arr.length);
      }),
      { numRuns: 1000 },
    );
  });

  it("non-array input always returns empty array", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.string(),
          fc.integer(),
          fc.double(),
          fc.boolean(),
          fc.constant(null),
          fc.constant(undefined),
          fc.record({ a: fc.string() }),
        ),
        (nonArr) => {
          const r = parseChatSnippets(nonArr);
          expect(r).toHaveLength(0);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("all valid snippets are included — none dropped from clean arrays", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { minLength: 1, maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        expect(r).toHaveLength(arr.length);
      }),
      { numRuns: 500 },
    );
  });

  it("invalid snippets are always filtered out", () => {
    fc.assert(
      fc.property(fc.array(invalidSnippetArb, { minLength: 1, maxLength: 20 }), (arr) => {
        const r = parseChatSnippets(arr);
        expect(r).toHaveLength(0);
      }),
      { numRuns: 500 },
    );
  });
});

// ─── Role coercion ────────────────────────────────────────────────────────

describe("parseChatSnippets — role coercion", () => {
  it("role='user' is preserved exactly", () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 1 }),
          agentName: fc.string({ minLength: 1 }),
          text: fc.string(),
          updatedAt: fc.nat(),
        }),
        (base) => {
          const r = parseChatSnippets([{ ...base, role: "user" }]);
          expect(r).toHaveLength(1);
          expect(r[0].role).toBe("user");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("role='assistant' is preserved exactly", () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 1 }),
          agentName: fc.string({ minLength: 1 }),
          text: fc.string(),
          updatedAt: fc.nat(),
        }),
        (base) => {
          const r = parseChatSnippets([{ ...base, role: "assistant" }]);
          expect(r).toHaveLength(1);
          expect(r[0].role).toBe("assistant");
        },
      ),
      { numRuns: 300 },
    );
  });

  it("any non-'user' role is coerced to 'assistant'", () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 1 }),
          agentName: fc.string({ minLength: 1 }),
          text: fc.string(),
        }),
        invalidRole,
        (base, role) => {
          const r = parseChatSnippets([{ ...base, role }]);
          if (r.length > 0) {
            // if it passed validation, role must be 'assistant' (since role !== 'user')
            if (role !== "user") {
              expect(r[0].role).toBe("assistant");
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── updatedAt coercion ───────────────────────────────────────────────────

describe("parseChatSnippets — updatedAt coercion", () => {
  it("numeric updatedAt is preserved", () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 1 }),
          agentName: fc.string({ minLength: 1 }),
          text: fc.string(),
          role: validRole,
          updatedAt: fc.nat({ max: 9_999_999_999_999 }),
        }),
        (item) => {
          const r = parseChatSnippets([item]);
          expect(r).toHaveLength(1);
          expect(r[0].updatedAt).toBe(item.updatedAt);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("non-numeric updatedAt falls back to a positive finite number", () => {
    fc.assert(
      fc.property(
        fc.record({
          agentId: fc.string({ minLength: 1 }),
          agentName: fc.string({ minLength: 1 }),
          text: fc.string(),
          role: validRole,
          updatedAt: fc.oneof(
            fc.string(),
            fc.constant(null),
            fc.constant(undefined),
            fc.boolean(),
            fc.record({}),
          ),
        }),
        (item) => {
          const r = parseChatSnippets([item]);
          expect(r).toHaveLength(1);
          expect(typeof r[0].updatedAt).toBe("number");
          expect(Number.isFinite(r[0].updatedAt)).toBe(true);
          expect(r[0].updatedAt).toBeGreaterThan(0);
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── Mixed valid/invalid arrays ───────────────────────────────────────────

describe("parseChatSnippets — mixed arrays", () => {
  it("valid items in mixed array are all included", () => {
    fc.assert(
      fc.property(
        fc.array(validSnippetArb, { minLength: 1, maxLength: 10 }),
        fc.array(invalidSnippetArb, { minLength: 1, maxLength: 10 }),
        (valids, invalids) => {
          // Interleave valid and invalid
          const mixed: unknown[] = [];
          const maxLen = Math.max(valids.length, invalids.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < valids.length) mixed.push(valids[i]);
            if (i < invalids.length) mixed.push(invalids[i]);
          }
          const r = parseChatSnippets(mixed);
          // All valid ones must survive
          expect(r.length).toBeGreaterThanOrEqual(valids.length);
          // But total never exceeds mixed count
          expect(r.length).toBeLessThanOrEqual(mixed.length);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("output preserves relative order of valid items", () => {
    fc.assert(
      fc.property(
        fc.array(validSnippetArb, { minLength: 2, maxLength: 10 }),
        (arr) => {
          const r = parseChatSnippets(arr);
          // agentId sequence in output matches input order
          const inputIds = arr.map((a) => a.agentId);
          const outputIds = r.map((x) => x.agentId);
          // outputIds is a subsequence of inputIds
          let j = 0;
          for (const id of inputIds) {
            if (j < outputIds.length && outputIds[j] === id) j++;
          }
          expect(j).toBe(outputIds.length);
        },
      ),
      { numRuns: 500 },
    );
  });

  it("large array (500 items) processes without error", () => {
    const largeArr = Array.from({ length: 500 }, (_, i) => ({
      agentId: `agent-${i}`,
      agentName: `Agent ${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      text: `Message number ${i}`,
      updatedAt: Date.now() - i * 1000,
    }));
    const r = parseChatSnippets(largeArr);
    expect(r).toHaveLength(500);
  });

  it("injection strings in text/agentId don't cause errors", () => {
    const injections = [
      "<script>alert(1)</script>",
      "'; DROP TABLE snippets; --",
      "\0\x00\x01null byte",
      "a".repeat(10_000),
      "🔥🚀💀",
      "\n\r\t",
    ];
    const raw = injections.map((text, i) => ({
      agentId: `agent-${i}`,
      agentName: `Agent ${i}`,
      role: "user",
      text,
      updatedAt: 1,
    }));
    expect(() => parseChatSnippets(raw)).not.toThrow();
    const r = parseChatSnippets(raw);
    expect(r).toHaveLength(injections.length);
    // text is preserved verbatim
    r.forEach((item, i) => expect(item.text).toBe(injections[i]));
  });
});

// ─── Idempotency ──────────────────────────────────────────────────────────

describe("parseChatSnippets — idempotency", () => {
  it("parsing the output again yields the same result (stable representation)", () => {
    fc.assert(
      fc.property(fc.array(validSnippetArb, { minLength: 1, maxLength: 10 }), (arr) => {
        const r1 = parseChatSnippets(arr);
        const r2 = parseChatSnippets(r1);
        expect(r2).toHaveLength(r1.length);
        for (let i = 0; i < r1.length; i++) {
          expect(r2[i].agentId).toBe(r1[i].agentId);
          expect(r2[i].agentName).toBe(r1[i].agentName);
          expect(r2[i].role).toBe(r1[i].role);
          expect(r2[i].text).toBe(r1[i].text);
          expect(r2[i].updatedAt).toBe(r1[i].updatedAt);
        }
      }),
      { numRuns: 500 },
    );
  });
});
