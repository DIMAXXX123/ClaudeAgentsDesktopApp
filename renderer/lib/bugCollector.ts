type Entry = {
  ts: number;
  source: "client" | "server" | "typecheck" | "test";
  kind: "error" | "warn";
  message: string;
  stack?: string;
  fixed?: boolean;
};

const store: Entry[] = [];
const MAX = 500;

export function recordBug(e: Omit<Entry, "ts" | "fixed">) {
  const entry: Entry = { ...e, ts: Date.now() };
  store.unshift(entry);
  if (store.length > MAX) store.length = MAX;
}

export function listBugs(since?: number) {
  return since ? store.filter((b) => b.ts >= since && !b.fixed) : store.slice();
}

export function unfixed() {
  return store.filter((b) => !b.fixed);
}

export function markFixed(beforeTs: number) {
  let n = 0;
  for (const b of store) {
    if (!b.fixed && b.ts <= beforeTs) {
      b.fixed = true;
      n++;
    }
  }
  return n;
}

export function clearBugs() {
  store.length = 0;
}
