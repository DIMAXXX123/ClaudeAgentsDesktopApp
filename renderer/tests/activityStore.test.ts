import { describe, it, expect, beforeEach, vi } from "vitest";
import fc from "fast-check";
import { activityStore } from "@/lib/activityStore";

describe("activityStore", () => {
  beforeEach(() => {
    for (const id of Object.keys(activityStore.snapshot())) {
      activityStore.set(id, "idle");
    }
  });

  it("set/get roundtrips", () => {
    activityStore.set("ultron", "working");
    expect(activityStore.get("ultron")).toBe("working");
  });

  it("idle removes from snapshot", () => {
    activityStore.set("nova", "working");
    activityStore.set("nova", "idle");
    expect(activityStore.snapshot()).not.toHaveProperty("nova");
  });

  it("subscribers are notified only on actual change", () => {
    const spy = vi.fn();
    const un = activityStore.subscribe(spy);
    activityStore.set("forge", "working");
    activityStore.set("forge", "working"); // no-op
    activityStore.set("forge", "error");
    un();
    activityStore.set("forge", "idle");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("fuzz: random sequences never crash and snapshot stays in sync", () => {
    const ids = ["a", "b", "c", "d", "e"];
    fc.assert(
      fc.property(
        fc.array(
          fc.tuple(
            fc.constantFrom(...ids),
            fc.constantFrom("idle", "working", "error" as const),
          ),
          { maxLength: 50 },
        ),
        (ops) => {
          for (const [id, val] of ops) {
            activityStore.set(id, val as "idle" | "working" | "error");
          }
          const snap = activityStore.snapshot();
          for (const id of ids) {
            if (activityStore.get(id) === "idle") {
              expect(snap).not.toHaveProperty(id);
            } else {
              expect(snap[id]).toBe(activityStore.get(id));
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
