import { BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

type ListenerStatus = 'idle' | 'starting' | 'connected' | 'error' | 'stopped';

interface ListenerState {
  process: ChildProcess | null;
  status: ListenerStatus;
  restartCount: number;
  restartBackoffs: number[];
  restartTimeout: NodeJS.Timeout | null;
  lastError: string | null;
}

const PYTHON_PATH =
  process.env.ULTRONOS_PYTHON ||
  path.join(os.homedir(), 'AppData', 'Local', 'Python', 'bin', 'python3.exe');
const BOT_CWD =
  process.env.ULTRONOS_TG_BOT_DIR ||
  path.join(os.homedir(), 'Documents', 'claude-workspace', 'telegram-bot');
const RESTART_BACKOFFS = [2000, 5000, 15000, 30000];

let state: ListenerState = {
  process: null,
  status: 'idle',
  restartCount: 0,
  restartBackoffs: RESTART_BACKOFFS,
  restartTimeout: null,
  lastError: null,
};

export function startListener(window: BrowserWindow): void {
  if (state.status !== 'idle') {
    console.log('[listener] already starting/running, skipping');
    return;
  }

  if (!fs.existsSync(PYTHON_PATH)) {
    const msg = `Python not found at ${PYTHON_PATH}`;
    console.error('[listener]', msg);
    updateStatus(window, 'error', msg);
    return;
  }

  if (!fs.existsSync(BOT_CWD)) {
    const msg = `Bot directory not found: ${BOT_CWD}`;
    console.error('[listener]', msg);
    updateStatus(window, 'error', msg);
    return;
  }

  state.status = 'starting';
  state.restartCount = 0;
  state.lastError = null;
  updateStatus(window, 'starting');

  const proc = spawn(PYTHON_PATH, ['simple_bot.py'], {
    cwd: BOT_CWD,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  state.process = proc;

  let stdoutBuffer = '';
  proc.stdout?.on('data', (data: Buffer) => {
    const chunk = data.toString('utf8');
    stdoutBuffer += chunk;

    // Forward logs to renderer
    const lines = stdoutBuffer.split('\n');
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      window.webContents.send('ultronos:listener:log', {
        line,
        level: line.includes('ERROR') ? 'error' : line.includes('WARNING') ? 'warning' : 'info',
        timestamp: new Date().toISOString(),
      });

      // Detect ready state from "Polling started" log
      if (line.includes('Polling started')) {
        console.log('[listener] bot ready (polling started)');
        updateStatus(window, 'connected');
      }
    }
    stdoutBuffer = lines[lines.length - 1];
  });

  proc.stderr?.on('data', (data: Buffer) => {
    const chunk = data.toString('utf8');
    const msg = `[STDERR] ${chunk}`;
    console.error('[listener]', msg);
    window.webContents.send('ultronos:listener:log', {
      line: msg,
      level: 'error',
      timestamp: new Date().toISOString(),
    });
  });

  proc.on('error', (err: Error) => {
    const msg = `spawn error: ${err.message}`;
    console.error('[listener]', msg);
    state.lastError = msg;
    updateStatus(window, 'error', msg);
    scheduleRestart(window);
  });

  proc.on('exit', (code: number | null, signal: string | null) => {
    console.log(`[listener] process exited: code=${code}, signal=${signal}`);
    if (state.status !== 'stopped') {
      state.lastError = `Exited: code ${code}, signal ${signal}`;
      updateStatus(window, 'error', state.lastError);
      scheduleRestart(window);
    }
    state.process = null;
  });

  console.log('[listener] spawned:', PYTHON_PATH, 'in', BOT_CWD);
}

export function stopListener(): void {
  if (state.restartTimeout) {
    clearTimeout(state.restartTimeout);
    state.restartTimeout = null;
  }

  if (state.process) {
    console.log('[listener] terminating process');
    state.process.kill('SIGTERM');
    state.process = null;
  }

  state.status = 'stopped';
  state.restartCount = 0;
  state.lastError = null;
}

export function getListenerStatus(): {
  status: ListenerStatus;
  restartCount: number;
  lastError: string | null;
} {
  return {
    status: state.status,
    restartCount: state.restartCount,
    lastError: state.lastError,
  };
}

export function restartListener(window: BrowserWindow): void {
  console.log('[listener] manual restart requested');
  stopListener();
  setTimeout(() => {
    startListener(window);
  }, 500);
}

// Internal helpers

function updateStatus(
  window: BrowserWindow,
  status: ListenerStatus,
  error: string | null = null
): void {
  state.status = status;
  if (error) state.lastError = error;

  window.webContents.send('ultronos:listener:status', {
    status,
    error,
    restartCount: state.restartCount,
    timestamp: new Date().toISOString(),
  });

  console.log(`[listener] status=${status}${error ? ` error=${error}` : ''}`);
}

function scheduleRestart(window: BrowserWindow): void {
  if (state.status === 'stopped') return;

  const delay = state.restartBackoffs[Math.min(state.restartCount, state.restartBackoffs.length - 1)];
  state.restartCount++;

  console.log(`[listener] scheduling restart in ${delay}ms (attempt ${state.restartCount})`);

  if (state.restartTimeout) {
    clearTimeout(state.restartTimeout);
  }

  state.restartTimeout = setTimeout(() => {
    state.restartTimeout = null;
    state.status = 'idle';
    state.process = null;
    startListener(window);
  }, delay);
}
