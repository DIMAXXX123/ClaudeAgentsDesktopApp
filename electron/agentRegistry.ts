import { ChildProcess, spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import { appendTranscript, TranscriptEvent } from './persistence';

export interface AgentRuntime {
  sessionId: string;
  agentId: string;
  process: ChildProcess | null;
  status: 'spawning' | 'running' | 'idle' | 'error' | 'dead';
  pid: number | null;
  createdAt: number;
  lastActivity: number;
  claudeSessionId: string | null;
}

type AgentOutputEvent =
  | { sessionId: string; agentId: string; kind: 'assistant_text'; text: string }
  | { sessionId: string; agentId: string; kind: 'tool_use'; name: string; input: unknown; id: string }
  | { sessionId: string; agentId: string; kind: 'tool_result'; id: string; output: string; isError?: boolean }
  | { sessionId: string; agentId: string; kind: 'status'; message: string }
  | { sessionId: string; agentId: string; kind: 'error'; message: string }
  | { sessionId: string; agentId: string; kind: 'done'; result?: string };

const CLAUDE_BIN = process.env.ULTRONOS_CLAUDE_BIN || 'claude';

function broadcastOutput(ev: AgentOutputEvent): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('ultronos:agent:output', ev);
  }
}

function broadcastStatus(
  sessionId: string,
  agentId: string,
  status: AgentRuntime['status'],
  extra?: Record<string, unknown>,
): void {
  for (const w of BrowserWindow.getAllWindows()) {
    w.webContents.send('ultronos:agent:status', { sessionId, agentId, status, ...(extra ?? {}) });
  }
}

class AgentRegistryManager {
  private runtimes: Map<string, AgentRuntime> = new Map();
  private writeQueues: Map<string, Promise<void>> = new Map();

  spawnAgent(agentId: string, _opts?: { systemPrompt?: string }): AgentRuntime {
    const sessionId = this.generateSessionId();
    const now = Date.now();

    const runtime: AgentRuntime = {
      sessionId,
      agentId,
      process: null,
      status: 'idle',
      pid: null,
      createdAt: now,
      lastActivity: now,
      claudeSessionId: null,
    };

    this.runtimes.set(sessionId, runtime);
    this.enqueueTranscriptWrite(agentId, sessionId, {
      ts: now,
      kind: 'status',
      data: `session created for agent=${agentId}`,
    });
    broadcastStatus(sessionId, agentId, 'idle');

    return runtime;
  }

  async sendInput(sessionId: string, text: string): Promise<{ written: number }> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) throw new Error(`No agent session: ${sessionId}`);

    if (runtime.process && !runtime.process.killed) {
      // A previous turn is still running — for now, reject.
      throw new Error('Agent is busy — wait for current turn to finish');
    }

    runtime.status = 'running';
    runtime.lastActivity = Date.now();
    broadcastStatus(sessionId, runtime.agentId, 'running');

    this.enqueueTranscriptWrite(runtime.agentId, sessionId, {
      ts: Date.now(),
      kind: 'input',
      data: text,
      role: 'user',
    });

    const args = [
      '-p',
      text,
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'acceptEdits',
    ];
    if (runtime.claudeSessionId) {
      args.push('--resume', runtime.claudeSessionId);
    }

    let proc: ChildProcess;
    try {
      proc = spawn(CLAUDE_BIN, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          USERPROFILE: process.env.USERPROFILE,
          APPDATA: process.env.APPDATA,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          SystemRoot: process.env.SystemRoot,
        },
      });
    } catch (err) {
      runtime.status = 'error';
      const msg = err instanceof Error ? err.message : String(err);
      broadcastOutput({ sessionId, agentId: runtime.agentId, kind: 'error', message: msg });
      broadcastStatus(sessionId, runtime.agentId, 'error', { error: msg });
      throw err;
    }

    runtime.process = proc;
    runtime.pid = proc.pid ?? null;

    this.attachProcessListeners(runtime);
    return { written: text.length };
  }

  private attachProcessListeners(runtime: AgentRuntime): void {
    const { process: proc, sessionId, agentId } = runtime;
    if (!proc) return;

    let stdoutBuf = '';

    proc.stdout?.on('data', (data: Buffer) => {
      runtime.lastActivity = Date.now();
      stdoutBuf += data.toString('utf-8');
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        this.handleStreamJsonLine(runtime, trimmed);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      runtime.lastActivity = Date.now();
      const text = data.toString('utf-8').trimEnd();
      if (!text) return;
      this.enqueueTranscriptWrite(agentId, sessionId, {
        ts: Date.now(),
        kind: 'stderr',
        data: text,
      });
      broadcastOutput({ sessionId, agentId, kind: 'error', message: text });
    });

    proc.on('exit', (code) => {
      if (stdoutBuf.trim()) {
        this.handleStreamJsonLine(runtime, stdoutBuf.trim());
        stdoutBuf = '';
      }
      runtime.status = code === 0 ? 'idle' : 'error';
      runtime.lastActivity = Date.now();
      runtime.process = null;
      runtime.pid = null;
      this.enqueueTranscriptWrite(agentId, sessionId, {
        ts: Date.now(),
        kind: 'status',
        data: `claude process exited code=${code}`,
      });
      broadcastStatus(sessionId, agentId, runtime.status, { exitCode: code });
    });

    proc.on('error', (err) => {
      runtime.status = 'error';
      runtime.process = null;
      runtime.pid = null;
      this.enqueueTranscriptWrite(agentId, sessionId, {
        ts: Date.now(),
        kind: 'stderr',
        data: `process error: ${err.message}`,
      });
      broadcastOutput({ sessionId, agentId, kind: 'error', message: err.message });
      broadcastStatus(sessionId, agentId, 'error', { error: err.message });
    });
  }

  private handleStreamJsonLine(runtime: AgentRuntime, line: string): void {
    const { sessionId, agentId } = runtime;
    let obj: Record<string, unknown>;
    try {
      obj = JSON.parse(line) as Record<string, unknown>;
    } catch {
      this.enqueueTranscriptWrite(agentId, sessionId, {
        ts: Date.now(),
        kind: 'stdout',
        data: line,
      });
      return;
    }

    if (typeof obj.session_id === 'string') {
      runtime.claudeSessionId = obj.session_id;
    }

    const type = obj.type;

    if (type === 'assistant') {
      const msg = obj.message as { content?: Array<Record<string, unknown>> } | undefined;
      const content = msg?.content ?? [];
      for (const block of content) {
        if (block.type === 'text' && typeof block.text === 'string') {
          this.enqueueTranscriptWrite(agentId, sessionId, {
            ts: Date.now(),
            kind: 'stdout',
            data: block.text,
            role: 'assistant',
          });
          broadcastOutput({ sessionId, agentId, kind: 'assistant_text', text: block.text });
        } else if (block.type === 'tool_use' && typeof block.name === 'string') {
          broadcastOutput({
            sessionId,
            agentId,
            kind: 'tool_use',
            name: block.name,
            input: block.input,
            id: typeof block.id === 'string' ? block.id : '',
          });
        }
      }
    } else if (type === 'user') {
      const msg = obj.message as { content?: Array<Record<string, unknown>> } | undefined;
      const content = msg?.content ?? [];
      for (const block of content) {
        if (block.type === 'tool_result') {
          const raw = block.content;
          const output =
            typeof raw === 'string'
              ? raw
              : Array.isArray(raw)
                ? raw
                    .map((c) =>
                      typeof c === 'object' && c !== null && 'text' in c && typeof (c as { text: unknown }).text === 'string'
                        ? ((c as { text: string }).text)
                        : '',
                    )
                    .join('\n')
                : JSON.stringify(raw);
          broadcastOutput({
            sessionId,
            agentId,
            kind: 'tool_result',
            id: typeof block.tool_use_id === 'string' ? block.tool_use_id : '',
            output: output.slice(0, 4000),
            isError: block.is_error === true,
          });
        }
      }
    } else if (type === 'result') {
      const result = typeof obj.result === 'string' ? obj.result : undefined;
      broadcastOutput({ sessionId, agentId, kind: 'done', result });
    } else if (type === 'system') {
      broadcastOutput({
        sessionId,
        agentId,
        kind: 'status',
        message: typeof obj.subtype === 'string' ? obj.subtype : 'system',
      });
    }
  }

  async killAgent(
    sessionId: string,
    signal: NodeJS.Signals = 'SIGTERM',
  ): Promise<{ killed: boolean; exitCode: number | null }> {
    const runtime = this.runtimes.get(sessionId);
    if (!runtime) return { killed: false, exitCode: null };

    if (!runtime.process) {
      runtime.status = 'dead';
      broadcastStatus(sessionId, runtime.agentId, 'dead');
      return { killed: false, exitCode: null };
    }

    const proc = runtime.process;
    return new Promise((resolve) => {
      const killTimer = setTimeout(() => {
        if (!proc.killed) proc.kill('SIGKILL');
      }, 2000);

      proc.once('exit', (code) => {
        clearTimeout(killTimer);
        runtime.status = 'dead';
        runtime.process = null;
        this.enqueueTranscriptWrite(runtime.agentId, sessionId, {
          ts: Date.now(),
          kind: 'status',
          data: `process terminated signal=${signal}`,
        });
        broadcastStatus(sessionId, runtime.agentId, 'dead', { exitCode: code });
        resolve({ killed: true, exitCode: code ?? null });
      });

      proc.kill(signal);
    });
  }

  async restartAgent(agentId: string, opts?: { systemPrompt?: string }): Promise<AgentRuntime> {
    const toKill = Array.from(this.runtimes.values()).filter((r) => r.agentId === agentId);
    for (const rt of toKill) await this.killAgent(rt.sessionId);
    return this.spawnAgent(agentId, opts);
  }

  getRuntime(sessionId: string): AgentRuntime | undefined {
    return this.runtimes.get(sessionId);
  }

  listRuntimes(): AgentRuntime[] {
    return Array.from(this.runtimes.values());
  }

  async killAll(): Promise<void> {
    const runtimes = Array.from(this.runtimes.values());
    await Promise.all(runtimes.map((rt) => this.killAgent(rt.sessionId)));
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private enqueueTranscriptWrite(agentId: string, sessionId: string, ev: TranscriptEvent): void {
    const key = sessionId;
    const current = this.writeQueues.get(key) ?? Promise.resolve();
    const next = current
      .then(() => appendTranscript(agentId, sessionId, ev))
      .catch((err) => {
        console.error(`[transcript] write failed for ${sessionId}:`, err);
      });
    this.writeQueues.set(key, next);
  }
}

export const agentRegistry = new AgentRegistryManager();
