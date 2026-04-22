import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { heartbeatIsStale } from "@/lib/conductorFs";
import { DEFAULTS } from "@/lib/conductor";

describe("heartbeat stale detector", () => {
  it("null heartbeat is stale", () => {
    expect(heartbeatIsStale(null, Date.now())).toBe(true);
  });

  it("fresh heartbeat not stale", () => {
    const now = Date.now();
    expect(heartbeatIsStale({ ts: now - 1000 }, now)).toBe(false);
  });

  it("property: stale iff age > threshold", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 * 60 * 60 * 24 }), (ageMs) => {
        const now = Date.now();
        const hb = { ts: now - ageMs };
        const expected = ageMs > DEFAULTS.HEARTBEAT_STALE_MS;
        return heartbeatIsStale(hb, now) === expected;
      }),
      { numRuns: 100 },
    );
  });
});
