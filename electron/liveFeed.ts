import { BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type FeedChannel = 'conductor-heartbeat' | 'conductor-plan' | 'scout' | 'tg' | 'listener-sessions';

interface WatcherState {
  path: string;
  size: number; // for jsonl tail tracking
  watcher: fs.FSWatcher | null;
}

const watchers = new Map<FeedChannel, WatcherState>();
let debounceTimers = new Map<FeedChannel, NodeJS.Timeout>();

const DEBOUNCE_MS = 250;

function getOvernightDir(): string {
  const envDir = process.env.ULTRONOS_DATA_DIR;
  return envDir
    ? path.join(envDir, '.overnight-plan')
    : path.join(process.cwd(), '.overnight-plan');
}

function getTgFeedPath(): string {
  return (
    process.env.TG_FEED_PATH ||
    path.join(os.homedir(), 'Documents', 'claude-workspace', 'telegram-bot', 'data', 'tg_feed.jsonl')
  );
}

function getSessionsPath(): string {
  return path.join(os.homedir(), 'Documents', 'claude-workspace', 'telegram-bot', 'data', 'sessions.json');
}

async function readJsonlTail(filePath: string, startSize: number): Promise<string[]> {
  try {
    const stat = await fs.promises.stat(filePath);
    if (stat.size <= startSize) return [];

    const fh = await fs.promises.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(stat.size - startSize);
      await fh.read(buf, 0, buf.length, startSize);
      const text = buf.toString('utf-8');
      return text.split('\n').filter((l) => l.trim().length > 0);
    } finally {
      await fh.close();
    }
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return [];
    console.error(`[liveFeed] Error reading ${filePath}:`, err);
    return [];
  }
}

async function readJsonFile(filePath: string): Promise<unknown | null> {
  try {
    const raw = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sendToRenderer(window: BrowserWindow, channel: FeedChannel, data: unknown): void {
  window.webContents.send(`ultronos:feed:${channel}`, data);
}

function debounce(channel: FeedChannel, fn: () => Promise<void>): void {
  const existing = debounceTimers.get(channel);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    fn().catch((err) => console.error(`[liveFeed] Error in ${channel}:`, err));
    debounceTimers.delete(channel);
  }, DEBOUNCE_MS);

  debounceTimers.set(channel, timer);
}

async function onConductorHeartbeatChange(window: BrowserWindow): Promise<void> {
  const filePath = path.join(getOvernightDir(), 'heartbeat.json');
  const data = await readJsonFile(filePath);
  if (data) sendToRenderer(window, 'conductor-heartbeat', data);
}

async function onConductorPlanChange(window: BrowserWindow): Promise<void> {
  const filePath = path.join(getOvernightDir(), 'plan.json');
  const data = await readJsonFile(filePath);
  if (data) sendToRenderer(window, 'conductor-plan', data);
}

async function onScoutFeedChange(window: BrowserWindow, state: WatcherState): Promise<void> {
  const lines = await readJsonlTail(state.path, state.size);
  try {
    const stat = await fs.promises.stat(state.path);
    state.size = stat.size;
  } catch {
    // ignore
  }

  if (lines.length > 0) {
    const parsed: unknown[] = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        // skip malformed
      }
    }
    if (parsed.length > 0) {
      sendToRenderer(window, 'scout', parsed);
    }
  }
}

async function onTgFeedChange(window: BrowserWindow, state: WatcherState): Promise<void> {
  const lines = await readJsonlTail(state.path, state.size);
  try {
    const stat = await fs.promises.stat(state.path);
    state.size = stat.size;
  } catch {
    // ignore
  }

  if (lines.length > 0) {
    const parsed: unknown[] = [];
    for (const line of lines) {
      try {
        parsed.push(JSON.parse(line));
      } catch {
        // skip malformed
      }
    }
    if (parsed.length > 0) {
      sendToRenderer(window, 'tg', parsed);
    }
  }
}

async function onListenerSessionsChange(window: BrowserWindow): Promise<void> {
  const filePath = getSessionsPath();
  const data = await readJsonFile(filePath);
  if (data) sendToRenderer(window, 'listener-sessions', data);
}

export async function startLiveFeed(window: BrowserWindow): Promise<void> {
  try {
    // 1. conductor-heartbeat
    const heartbeatPath = path.join(getOvernightDir(), 'heartbeat.json');
    const hbWatcher = fs.watch(heartbeatPath, { persistent: false }, () => {
      debounce('conductor-heartbeat', () => onConductorHeartbeatChange(window));
    });
    watchers.set('conductor-heartbeat', { path: heartbeatPath, size: 0, watcher: hbWatcher });
    await onConductorHeartbeatChange(window).catch(console.error);

    // 2. conductor-plan
    const planPath = path.join(getOvernightDir(), 'plan.json');
    const planWatcher = fs.watch(planPath, { persistent: false }, () => {
      debounce('conductor-plan', () => onConductorPlanChange(window));
    });
    watchers.set('conductor-plan', { path: planPath, size: 0, watcher: planWatcher });
    await onConductorPlanChange(window).catch(console.error);

    // 3. scout-feed
    const scoutPath = path.join(getOvernightDir(), 'scout-feed.jsonl');
    const scoutState: WatcherState = { path: scoutPath, size: 0, watcher: null };
    try {
      const stat = await fs.promises.stat(scoutPath);
      scoutState.size = stat.size;
    } catch {
      // file doesn't exist yet, start at 0
    }
    const scoutWatcher = fs.watch(scoutPath, { persistent: false }, () => {
      debounce('scout', () => onScoutFeedChange(window, scoutState));
    });
    scoutState.watcher = scoutWatcher;
    watchers.set('scout', scoutState);

    // 4. tg-feed
    const tgPath = getTgFeedPath();
    const tgState: WatcherState = { path: tgPath, size: 0, watcher: null };
    try {
      const stat = await fs.promises.stat(tgPath);
      tgState.size = stat.size;
    } catch {
      // file doesn't exist yet
    }
    const tgWatcher = fs.watch(tgPath, { persistent: false }, () => {
      debounce('tg', () => onTgFeedChange(window, tgState));
    });
    tgState.watcher = tgWatcher;
    watchers.set('tg', tgState);

    // 5. listener-sessions
    const sessionsPath = getSessionsPath();
    const sessionsWatcher = fs.watch(sessionsPath, { persistent: false }, () => {
      debounce('listener-sessions', () => onListenerSessionsChange(window));
    });
    watchers.set('listener-sessions', { path: sessionsPath, size: 0, watcher: sessionsWatcher });
    await onListenerSessionsChange(window).catch(console.error);

    console.log('[liveFeed] Started watching 5 channels');
  } catch (err) {
    console.error('[liveFeed] Failed to start:', err);
  }
}

export function stopLiveFeed(): void {
  for (const [channel, state] of watchers.entries()) {
    if (state.watcher) {
      state.watcher.close();
    }
    const timer = debounceTimers.get(channel as FeedChannel);
    if (timer) clearTimeout(timer);
  }
  watchers.clear();
  debounceTimers.clear();
  console.log('[liveFeed] Stopped');
}
