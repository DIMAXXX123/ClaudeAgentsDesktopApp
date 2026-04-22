/**
 * bridgeExecutor — client-side helper for /api/bridge/execute SSE endpoint.
 *
 * Usage:
 *   for await (const evt of streamExecution("open-memory")) {
 *     console.log(evt.phase, evt.message);
 *   }
 *
 * Or fire-and-forget with the executionBus:
 *   executionBus.run("refresh-memory");
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ExecutionPhase = "start" | "progress" | "done" | "error";

export interface ExecutionEvent {
  phase: ExecutionPhase;
  command: string;
  message?: string;
  /** 0-100 progress hint */
  pct?: number;
  result?: string;
  durationMs?: number;
  error?: string;
  ts: number;
}

export interface ExecuteOptions {
  agentId?: string;
  payload?: Record<string, unknown>;
}

// An in-progress execution tracked by the bus
export interface ActiveExecution {
  id: string;
  command: string;
  agentId?: string;
  events: ExecutionEvent[];
  /** latest progress 0-100 */
  pct: number;
  status: "running" | "done" | "error";
  startedAt: number;
  finishedAt?: number;
  result?: string;
  error?: string;
}

// ── SSE stream helper ─────────────────────────────────────────────────────────

/**
 * Stream execution events from /api/bridge/execute.
 * Yields `ExecutionEvent` objects as they arrive.
 */
export async function* streamExecution(
  command: string,
  opts: ExecuteOptions = {},
): AsyncGenerator<ExecutionEvent> {
  let res: Response;
  try {
    res = await fetch("/api/bridge/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, ...opts }),
    });
  } catch (err) {
    yield {
      phase: "error",
      command,
      error: err instanceof Error ? err.message : "fetch failed",
      ts: Date.now(),
    };
    return;
  }

  if (!res.ok || !res.body) {
    yield { phase: "error", command, error: `HTTP ${res.status}`, ts: Date.now() };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    let chunk: { done: boolean; value?: Uint8Array };
    try {
      chunk = await reader.read();
    } catch {
      break;
    }
    if (chunk.done) break;

    buf += decoder.decode(chunk.value, { stream: true });

    // SSE protocol: events separated by blank lines
    const parts = buf.split("\n\n");
    buf = parts.pop() ?? "";

    for (const part of parts) {
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) {
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as ExecutionEvent;
            yield evt;
          } catch {
            // malformed SSE data — skip
          }
        }
      }
    }
  }
}

// ── Execution Bus ─────────────────────────────────────────────────────────────

type BusListener = (executions: ActiveExecution[]) => void;

let execIdCounter = 0;

class ExecutionBus {
  private executions: ActiveExecution[] = [];
  private listeners = new Set<BusListener>();

  /** Subscribe to changes. Returns unsubscribe fn. */
  subscribe(fn: BusListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private notify() {
    this.listeners.forEach((fn) => fn([...this.executions]));
  }

  getAll(): ActiveExecution[] {
    return [...this.executions];
  }

  /** Remove a completed execution from the list. */
  dismiss(id: string) {
    this.executions = this.executions.filter((e) => e.id !== id);
    this.notify();
  }

  /** Auto-dismiss finished executions after `delayMs`. */
  private scheduleDismiss(id: string, delayMs = 3500) {
    setTimeout(() => this.dismiss(id), delayMs);
  }

  /**
   * Run a command, streaming events into the bus.
   * Returns a Promise that resolves when execution finishes.
   */
  async run(command: string, opts: ExecuteOptions = {}): Promise<ActiveExecution> {
    const id = `exec-${++execIdCounter}-${Date.now()}`;
    const exec: ActiveExecution = {
      id,
      command,
      agentId: opts.agentId,
      events: [],
      pct: 0,
      status: "running",
      startedAt: Date.now(),
    };

    this.executions = [...this.executions, exec];
    this.notify();

    const updateExec = (patch: Partial<ActiveExecution>) => {
      this.executions = this.executions.map((e) => (e.id === id ? { ...e, ...patch } : e));
      this.notify();
    };

    try {
      for await (const evt of streamExecution(command, opts)) {
        const updated: Partial<ActiveExecution> = {
          events: [...exec.events, evt],
        };

        if (evt.phase === "progress") {
          updated.pct = evt.pct ?? exec.pct;
        } else if (evt.phase === "done") {
          updated.status = "done";
          updated.pct = 100;
          updated.finishedAt = Date.now();
          updated.result = evt.result;
          this.scheduleDismiss(id);
        } else if (evt.phase === "error") {
          updated.status = "error";
          updated.finishedAt = Date.now();
          updated.error = evt.error;
          this.scheduleDismiss(id, 5000);
        }

        // Mutate exec ref for return value
        Object.assign(exec, updated);
        updateExec(updated);
      }
    } catch {
      const errPatch: Partial<ActiveExecution> = {
        status: "error",
        finishedAt: Date.now(),
        error: "Stream interrupted",
      };
      Object.assign(exec, errPatch);
      updateExec(errPatch);
      this.scheduleDismiss(id, 5000);
    }

    return exec;
  }
}

/** Singleton bus — import and call `.run(command)` anywhere. */
export const executionBus = new ExecutionBus();

// ── Inline test (runs only in Node/Vitest env) ────────────────────────────────

if (process.env.NODE_ENV === "test") {
  (async () => {
    // Regression: streamExecution must yield error on bad fetch
    const mockFetch = async (): Promise<Response> =>
      new Response(null, { status: 503 });

    const events: ExecutionEvent[] = [];
    const originalFetch = globalThis.fetch;
    (globalThis as Record<string, unknown>).fetch = mockFetch;
    try {
      for await (const e of streamExecution("test-cmd")) {
        events.push(e);
      }
      console.assert(events[0]?.phase === "error", "should yield error on 503");
      console.assert(
        events[0]?.error?.includes("503"),
        `error should include 503, got: ${events[0]?.error}`,
      );
      console.log("[bridgeExecutor test] PASS: error event on 503");
    } finally {
      (globalThis as Record<string, unknown>).fetch = originalFetch;
    }
  })();
}
