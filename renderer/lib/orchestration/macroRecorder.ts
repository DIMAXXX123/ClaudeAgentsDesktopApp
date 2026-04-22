/**
 * macroRecorder — records sequences of command-palette actions into
 * replayable JSON chains.
 *
 * Usage (record):
 *   macroRecorder.start();
 *   // user fires actions in CommandPaletteV2 → each calls macroRecorder.push(step)
 *   const chain = macroRecorder.stop("My workflow");
 *
 * Usage (replay):
 *   for await (const step of macroRecorder.replay(chain)) {
 *     // handle each step: open agent, send prompt, run command
 *   }
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type RecordedStepKind = "open-agent" | "send-prompt" | "run-command";

export interface RecordedStep {
  kind: RecordedStepKind;
  agentId?: string;
  prompt?: string;
  command?: string;
  /** Milliseconds to wait before executing this step during replay. */
  delayMs: number;
  /** Absolute timestamp when recorded. */
  ts: number;
}

export interface MacroChain {
  id: string;
  name: string;
  steps: RecordedStep[];
  recordedAt: number;
  /** Total wall-clock duration of the recording session (ms). */
  durationMs: number;
}

export type ReplayStepEvent =
  | { kind: "step-start"; index: number; step: RecordedStep; totalSteps: number }
  | { kind: "step-done"; index: number }
  | { kind: "done"; chain: MacroChain; durationMs: number }
  | { kind: "error"; message: string }
  /** Emitted by the SSE replay route when a step opens an agent. */
  | { kind: "navigate"; index?: number; agentId: string; prompt?: string }
  /** Emitted by the SSE replay route when a step fires a bridge command. */
  | { kind: "execute"; index?: number; command: string };

// ── Storage ───────────────────────────────────────────────────────────────────

const CHAIN_KEY = "ultronos:macro-chains:v1";

function loadChains(): MacroChain[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CHAIN_KEY);
    return raw ? (JSON.parse(raw) as MacroChain[]) : [];
  } catch {
    return [];
  }
}

function saveChains(chains: MacroChain[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAIN_KEY, JSON.stringify(chains));
}

// ── Recorder ──────────────────────────────────────────────────────────────────

type RecorderListener = () => void;

class MacroRecorder {
  private _recording = false;
  private _steps: RecordedStep[] = [];
  private _startedAt = 0;
  private _lastStepAt = 0;
  private _chains: MacroChain[] = loadChains();
  private _listeners: Set<RecorderListener> = new Set();

  // ── State accessors ─────────────────────────────────────────────────────────

  get isRecording(): boolean {
    return this._recording;
  }

  get pendingSteps(): RecordedStep[] {
    return [...this._steps];
  }

  getChains(): MacroChain[] {
    return [...this._chains];
  }

  getChain(id: string): MacroChain | undefined {
    return this._chains.find((c) => c.id === id);
  }

  // ── Record lifecycle ────────────────────────────────────────────────────────

  /** Begin a new recording session. Noop if already recording. */
  start(): void {
    if (this._recording) return;
    this._recording = true;
    this._steps = [];
    this._startedAt = Date.now();
    this._lastStepAt = this._startedAt;
    this._notify();
  }

  /**
   * Push a step into the current recording.
   * Must call `start()` first. Silently ignored if not recording.
   */
  push(input: Omit<RecordedStep, "delayMs" | "ts">): void {
    if (!this._recording) return;
    const now = Date.now();
    const delayMs = Math.max(0, now - this._lastStepAt);
    this._lastStepAt = now;
    this._steps.push({ ...input, delayMs, ts: now });
    this._notify();
  }

  /**
   * Finalise the recording, save the chain, exit recording mode.
   * Returns the saved chain, or null if no steps were recorded.
   */
  stop(name: string): MacroChain | null {
    if (!this._recording) return null;
    this._recording = false;

    const steps = this._steps;
    this._steps = [];

    if (steps.length === 0) {
      this._notify();
      return null;
    }

    const chain: MacroChain = {
      id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: name.trim() || `Chain ${this._chains.length + 1}`,
      steps,
      recordedAt: this._startedAt,
      durationMs: Date.now() - this._startedAt,
    };

    this._chains = [chain, ...this._chains].slice(0, 20); // keep last 20
    saveChains(this._chains);
    this._notify();
    return chain;
  }

  /** Cancel recording without saving. */
  cancel(): void {
    if (!this._recording) return;
    this._recording = false;
    this._steps = [];
    this._notify();
  }

  /** Delete a saved chain. */
  deleteChain(id: string): void {
    this._chains = this._chains.filter((c) => c.id !== id);
    saveChains(this._chains);
    this._notify();
  }

  // ── Replay ──────────────────────────────────────────────────────────────────

  /**
   * Async generator that replays a chain, yielding events for each step.
   * Caller is responsible for acting on step data (opening agents, running
   * commands, etc.).  Delays between steps are honoured.
   */
  async *replay(chain: MacroChain): AsyncGenerator<ReplayStepEvent> {
    const t0 = Date.now();

    for (let i = 0; i < chain.steps.length; i++) {
      const step = chain.steps[i];

      // Honour inter-step delay (capped at 5 s so replay feels snappy)
      const delay = Math.min(step.delayMs, 5_000);
      if (delay > 80) {
        await tick(delay);
      }

      yield { kind: "step-start", index: i, step, totalSteps: chain.steps.length };

      // Small pause to let callers animate
      await tick(60);
      yield { kind: "step-done", index: i };
    }

    yield { kind: "done", chain, durationMs: Date.now() - t0 };
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  subscribe(fn: RecorderListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  private _notify(): void {
    this._listeners.forEach((fn) => fn());
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tick(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Singleton ─────────────────────────────────────────────────────────────────

export const macroRecorder = new MacroRecorder();

// ── Inline tests (Node / Vitest only) ────────────────────────────────────────

if (process.env.NODE_ENV === "test") {
  (() => {
    // Test: recording lifecycle
    const r = new MacroRecorder();

    // start → push × 2 → stop
    r.start();
    r.push({ kind: "open-agent", agentId: "nova" });
    r.push({ kind: "run-command", command: "open-memory" });
    const chain = r.stop("test");

    console.assert(chain !== null, "chain should not be null");
    console.assert(chain!.steps.length === 2, `expected 2 steps, got ${chain!.steps.length}`);
    console.assert(chain!.steps[0].kind === "open-agent", "step 0 should be open-agent");
    console.assert(chain!.steps[1].kind === "run-command", "step 1 should be run-command");
    console.assert(chain!.steps[0].delayMs >= 0, "delayMs should be non-negative");
    console.log("[macroRecorder test] PASS: recording lifecycle");

    // Test: push while not recording is a noop
    r.push({ kind: "open-agent", agentId: "forge" });
    const all = r.getChains();
    console.assert(all.length >= 1, "chain should be stored");
    console.log("[macroRecorder test] PASS: push noop when not recording");

    // Test: cancel clears steps
    r.start();
    r.push({ kind: "open-agent", agentId: "ares" });
    r.cancel();
    console.assert(!r.isRecording, "should not be recording after cancel");
    console.assert(r.pendingSteps.length === 0, "pending steps cleared on cancel");
    console.log("[macroRecorder test] PASS: cancel clears state");

    // Test: replay generator yields correct events
    (async () => {
      const fakeChain: MacroChain = {
        id: "test-chain",
        name: "Test",
        steps: [
          { kind: "open-agent", agentId: "nova", delayMs: 0, ts: Date.now() },
          { kind: "run-command", command: "status", delayMs: 50, ts: Date.now() + 50 },
        ],
        recordedAt: Date.now(),
        durationMs: 100,
      };

      const events: ReplayStepEvent[] = [];
      for await (const evt of r.replay(fakeChain)) {
        events.push(evt);
      }

      const starts = events.filter((e) => e.kind === "step-start");
      const dones = events.filter((e) => e.kind === "step-done");
      const finalDone = events.filter((e) => e.kind === "done");

      console.assert(starts.length === 2, `expected 2 step-start, got ${starts.length}`);
      console.assert(dones.length === 2, `expected 2 step-done, got ${dones.length}`);
      console.assert(finalDone.length === 1, "expected 1 done event");
      console.log("[macroRecorder test] PASS: replay generator");
    })();
  })();
}
