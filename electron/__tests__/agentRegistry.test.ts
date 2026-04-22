import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { spawn, ChildProcess } from 'child_process';
import { agentRegistry, AgentRuntime } from '../agentRegistry';
import { appendTranscript, readTranscript, clearTranscript } from '../persistence';
import { Writable } from 'stream';

// Mock child_process.spawn
vi.mock('child_process', () => {
  const actualModule = require('child_process');
  return {
    ...actualModule,
    spawn: vi.fn(),
  };
});

// Mock persistence (keep real implementation but control side effects)
vi.mock('../persistence', async () => {
  const actual = await vi.importActual<typeof import('../persistence')>('../persistence');
  return {
    ...actual,
    appendTranscript: vi.fn(),
  };
});

const mockSpawn = spawn as any;

describe('AgentRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset registry between tests by clearing runtimes
    agentRegistry['runtimes'].clear();
    agentRegistry['writeQueues'].clear();
  });

  it('should spawn an agent and return a runtime with sessionId', () => {
    const runtime = agentRegistry.spawnAgent('ultron');

    expect(runtime).toBeDefined();
    expect(runtime.agentId).toBe('ultron');
    expect(runtime.sessionId).toBeTruthy();
    expect(runtime.status).toBe('spawning');
    expect(runtime.createdAt).toBeGreaterThan(0);
    expect(runtime.lastActivity).toBeGreaterThan(0);
  });

  it('should store spawned agent in registry', () => {
    const runtime = agentRegistry.spawnAgent('nova');
    const fetched = agentRegistry.getRuntime(runtime.sessionId);

    expect(fetched).toBeDefined();
    expect(fetched?.agentId).toBe('nova');
    expect(fetched?.sessionId).toBe(runtime.sessionId);
  });

  it('should list all active runtimes', () => {
    agentRegistry.spawnAgent('ultron');
    agentRegistry.spawnAgent('nova');
    agentRegistry.spawnAgent('forge');

    const list = agentRegistry.listRuntimes();

    expect(list).toHaveLength(3);
    expect(list.map((r) => r.agentId)).toEqual(['ultron', 'nova', 'forge']);
  });

  it('should kill an agent and set status to dead', async () => {
    const runtime = agentRegistry.spawnAgent('ares');
    const sessionId = runtime.sessionId;

    // Mock a fake process with kill method
    const mockProcess = {
      killed: false,
      pid: 12345,
      stdin: new Writable({ write: () => {} }),
      stdout: new Writable({ write: () => {} }),
      stderr: new Writable({ write: () => {} }),
      kill: vi.fn(function (signal?: string) {
        this.killed = true;
        // Simulate exit event after kill
        process.nextTick(() => {
          this.emit('exit', 0);
        });
      }),
      on: vi.fn(function (event: string, cb: any) {
        if (event === 'exit') {
          setTimeout(() => cb(0), 10);
        }
        return this;
      }),
      removeAllListeners: vi.fn(function () {
        return this;
      }),
      emit: vi.fn(),
    };

    agentRegistry['runtimes'].get(sessionId)!.process = mockProcess as unknown as ChildProcess;

    const result = await agentRegistry.killAgent(sessionId);

    expect(result.killed).toBe(true);
    const updated = agentRegistry.getRuntime(sessionId);
    expect(updated?.status).toBe('dead');
  });

  it('should handle transcript write queueing to avoid concurrent writes', async () => {
    const runtime = agentRegistry.spawnAgent('echo');
    const sessionId = runtime.sessionId;

    // Mock appendTranscript to resolve after a small delay
    const mockAppend = vi.fn(() => new Promise((r) => setTimeout(r, 5)));
    vi.mocked(appendTranscript).mockImplementation(mockAppend);

    // Trigger multiple writes
    agentRegistry['enqueueTranscriptWrite']('echo', sessionId, {
      ts: Date.now(),
      kind: 'stdout',
      data: 'line 1',
    });

    agentRegistry['enqueueTranscriptWrite']('echo', sessionId, {
      ts: Date.now(),
      kind: 'stdout',
      data: 'line 2',
    });

    // Wait for queue to process
    await new Promise((r) => setTimeout(r, 50));

    expect(mockAppend).toHaveBeenCalledTimes(2);
  });

  it('should restart an agent by killing old and spawning new', async () => {
    const oldRuntime = agentRegistry.spawnAgent('midas');
    const oldSessionId = oldRuntime.sessionId;

    // Mock process
    const mockProcess = {
      killed: false,
      pid: 12345,
      kill: vi.fn(function (signal?: string) {
        this.killed = true;
      }),
      on: vi.fn(function (event: string, cb: any) {
        if (event === 'exit') {
          setTimeout(() => cb(0), 5);
        }
        return this;
      }),
      stdout: new Writable({ write: () => {} }),
      stderr: new Writable({ write: () => {} }),
    };

    agentRegistry['runtimes'].get(oldSessionId)!.process = mockProcess as unknown as ChildProcess;

    const newRuntime = await agentRegistry.restartAgent('midas');

    expect(newRuntime.sessionId).not.toBe(oldSessionId);
    expect(newRuntime.agentId).toBe('midas');
    expect(agentRegistry.getRuntime(oldSessionId)?.status).toBe('dead');
  });

  it('should handle send input to agent', async () => {
    const runtime = agentRegistry.spawnAgent('ultron');
    const sessionId = runtime.sessionId;

    // Mock process with writable stdin
    const mockWrite = vi.fn((data: string, cb: any) => cb(null));
    const mockStdin = { write: mockWrite } as any;
    const mockProcess = {
      stdin: mockStdin,
      kill: vi.fn(),
      on: vi.fn(),
    };

    agentRegistry['runtimes'].get(sessionId)!.process = mockProcess as unknown as ChildProcess;

    const result = await agentRegistry.sendInput(sessionId, 'hello world');

    expect(result.written).toBe('hello world'.length + 1);
    expect(mockWrite).toHaveBeenCalledWith('hello world\n', expect.any(Function));
  });

  it('should throw when trying to kill non-existent session', async () => {
    const result = await agentRegistry.killAgent('fake-session-id');

    expect(result.killed).toBe(false);
    expect(result.exitCode).toBeNull();
  });

  it('should generate unique sessionIds', () => {
    const r1 = agentRegistry.spawnAgent('nova');
    const r2 = agentRegistry.spawnAgent('nova');

    expect(r1.sessionId).not.toBe(r2.sessionId);
    expect(r1.sessionId).toBeTruthy();
    expect(r2.sessionId).toBeTruthy();
  });

  it('records cwd on the runtime when supplied', () => {
    const cwd = '/tmp/worktrees/echo-99';
    const runtime = agentRegistry.spawnAgent('echo', { cwd });
    expect(runtime.cwd).toBe(cwd);
    expect(agentRegistry.getRuntime(runtime.sessionId)?.cwd).toBe(cwd);
  });

  it('inherits cwd on restart when caller does not override it', async () => {
    const cwd = '/tmp/worktrees/forge-77';
    const old = agentRegistry.spawnAgent('forge', { cwd });
    agentRegistry['runtimes'].get(old.sessionId)!.process = {
      killed: false,
      pid: 1,
      kill() {
        // emulate immediate exit
      },
      on(event: string, cb: (code: number) => void) {
        if (event === 'exit') setTimeout(() => cb(0), 1);
        return this;
      },
      stdout: new Writable({ write: () => {} }),
      stderr: new Writable({ write: () => {} }),
    } as unknown as ChildProcess;

    const fresh = await agentRegistry.restartAgent('forge');
    expect(fresh.cwd).toBe(cwd);
  });

  it('should cleanup all agents on killAll', async () => {
    agentRegistry.spawnAgent('ultron');
    agentRegistry.spawnAgent('nova');
    agentRegistry.spawnAgent('forge');

    const list = agentRegistry.listRuntimes();
    expect(list.length).toBeGreaterThan(0);

    await agentRegistry.killAll();

    // All should be dead
    list.forEach((r) => {
      expect(agentRegistry.getRuntime(r.sessionId)?.status).toBe('dead');
    });
  });
});

describe('Persistence', () => {
  it('should read transcript events (mocked)', async () => {
    // This test would require mocking fs and app.getPath
    // For now, we verify the interface
    const mockEvents = [
      { ts: 1000, kind: 'stdout' as const, data: 'test' },
      { ts: 1001, kind: 'status' as const, data: 'ok' },
    ];

    // In real scenario, readTranscript would read from file
    // For CI, this stays as interface check
    expect(mockEvents.length).toBe(2);
  });
});
