import { contextBridge, ipcRenderer } from 'electron';

type UnsubscribeFn = () => void;
type TrayStatus = 'idle' | 'working' | 'error';
type NotificationUrgency = 'low' | 'normal' | 'critical';

const ultronos = {
  windowControls: {
    minimize: () => ipcRenderer.invoke('ultronos:window:minimize'),
    maximize: () => ipcRenderer.invoke('ultronos:window:maximize'),
    close: () => ipcRenderer.invoke('ultronos:window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('ultronos:window:is-maximized'),
  },

  onMaximizedChange: (cb: (isMax: boolean) => void): UnsubscribeFn => {
    ipcRenderer.on('ultronos:maximized-change', (_, isMax: boolean) => {
      cb(isMax);
    });

    // Return unsubscribe function
    return () => {
      ipcRenderer.removeAllListeners('ultronos:maximized-change');
    };
  },

  notify: (title: string, body: string, urgency?: NotificationUrgency): void => {
    ipcRenderer.send('ultronos:notify', { title, body, urgency });
  },

  setBadge: (count: number): void => {
    ipcRenderer.send('ultronos:badge', { count });
  },

  tray: {
    setTooltip: (text: string): void => {
      ipcRenderer.send('ultronos:tray:tooltip', { text });
    },

    setStatus: (status: TrayStatus): void => {
      ipcRenderer.send('ultronos:tray:status', { status });
    },
  },

  shell: {
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('ultronos:shell:open-external', { url }),
    openPath: (target: 'userData' | 'logs' | 'temp'): Promise<void> =>
      ipcRenderer.invoke('ultronos:shell:open-path', { target }),
  },

  settings: {
    get: () => ipcRenderer.invoke('ultronos:settings:get'),
    set: (patch: Record<string, unknown>) => ipcRenderer.invoke('ultronos:settings:set', patch),
    reset: () => ipcRenderer.invoke('ultronos:settings:reset'),
    defaults: () => ipcRenderer.invoke('ultronos:settings:defaults'),
  },

  zoom: {
    get: (): Promise<number> => ipcRenderer.invoke('ultronos:zoom:get'),
    set: (factor: number): Promise<number> => ipcRenderer.invoke('ultronos:zoom:set', { factor }),
    in: (): Promise<number> => ipcRenderer.invoke('ultronos:zoom:in'),
    out: (): Promise<number> => ipcRenderer.invoke('ultronos:zoom:out'),
    reset: (): Promise<number> => ipcRenderer.invoke('ultronos:zoom:reset'),
  },

  app: {
    info: () => ipcRenderer.invoke('ultronos:app:info'),
    relaunch: () => ipcRenderer.invoke('ultronos:app:relaunch'),
  },

  platform: process.platform as string,

  getDataDir: (): Promise<string> => ipcRenderer.invoke('ultronos:get-data-dir'),

  getFilePathForDrop: async (file: File): Promise<string | undefined> => {
    try {
      // In Electron 32+, file.path should be exposed from native drag-drop
      return (file as any).path;
    } catch {
      return undefined;
    }
  },

  agent: {
    spawn: (agentId: string, opts?: { systemPrompt?: string }) =>
      ipcRenderer.invoke('ultronos:agent:spawn', { agentId, opts }),
    kill: (sessionId: string) => ipcRenderer.invoke('ultronos:agent:kill', { sessionId }),
    input: (sessionId: string, text: string) => ipcRenderer.invoke('ultronos:agent:input', { sessionId, text }),
    list: () => ipcRenderer.invoke('ultronos:agent:list'),
    transcript: (sessionId: string, limit?: number) =>
      ipcRenderer.invoke('ultronos:agent:transcript', { sessionId, limit: limit ?? 200 }),
    clear: (sessionId: string) => ipcRenderer.invoke('ultronos:agent:clear', { sessionId }),
    restart: (agentId: string) => ipcRenderer.invoke('ultronos:agent:restart', { agentId }),
    onOutput: (cb: (ev: unknown) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:agent:output', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:agent:output');
    },
    onStatus: (cb: (ev: unknown) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:agent:status', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:agent:status');
    },
  },

  feed: {
    on: (channel: string, cb: (data: unknown) => void): UnsubscribeFn => {
      const key = `ultronos:feed:${channel}`;
      const handler = (_: unknown, data: unknown) => cb(data);
      ipcRenderer.on(key, handler);
      return () => ipcRenderer.removeListener(key, handler);
    },
  },

  listener: {
    start: () => ipcRenderer.invoke('ultronos:listener:start'),
    stop: () => ipcRenderer.invoke('ultronos:listener:stop'),
    restart: () => ipcRenderer.invoke('ultronos:listener:restart'),
    getStatus: () => ipcRenderer.invoke('ultronos:listener:status'),
    onLog: (cb: (ev: { line: string; level: string; timestamp: string }) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:listener:log', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:listener:log');
    },
    onStatus: (cb: (ev: { status: string; error?: string; restartCount: number; timestamp: string }) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:listener:status', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:listener:status');
    },
  },

  launcher: {
    hide: () => ipcRenderer.invoke('ultronos:launcher:hide'),
    execute: (action: string, args?: unknown) => ipcRenderer.invoke('ultronos:launcher:execute', { action, args }),
  },

  mode: {
    get: () => ipcRenderer.invoke('ultronos:mode:get'),
    set: (mode: string) => ipcRenderer.invoke('ultronos:mode:set', mode),
    list: () => ipcRenderer.invoke('ultronos:mode:list'),
    config: (mode: string) => ipcRenderer.invoke('ultronos:mode:config', mode),
    onChange: (cb: (mode: string) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:mode:changed', (_, m) => cb(m));
      return () => ipcRenderer.removeAllListeners('ultronos:mode:changed');
    },
  },

  win11ai: {
    available: (): Promise<boolean> => ipcRenderer.invoke('ultronos:win11ai:available'),
    ocr: (imagePath: string) => ipcRenderer.invoke('ultronos:win11ai:ocr', imagePath),
    summarize: (text: string) => ipcRenderer.invoke('ultronos:win11ai:summarize', text),
    describe: (imagePath: string) => ipcRenderer.invoke('ultronos:win11ai:describe', imagePath),
    generate: (prompt: string) => ipcRenderer.invoke('ultronos:win11ai:generate', prompt),
  },

  voice: {
    start: (recordingId: string) =>
      ipcRenderer.invoke('ultronos:voice:start', { recordingId }),
    stop: (recordingId: string, audioData: Uint8Array) =>
      ipcRenderer.invoke('ultronos:voice:stop', { recordingId, audioData }),
    transcribe: (recordingId: string, audioData: Uint8Array) =>
      ipcRenderer.invoke('ultronos:voice:transcribe', { recordingId, audioData }),
    sendToAgent: (sessionId: string, transcript: string) =>
      ipcRenderer.invoke('ultronos:voice:send-to-agent', { sessionId, transcript }),
    onPartial: (cb: (ev: { recordingId: string; partial: string }) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:voice:partial', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:voice:partial');
    },
    onComplete: (cb: (ev: { recordingId: string; transcript: string; duration: number }) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:voice:complete', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:voice:complete');
    },
    onError: (cb: (ev: { recordingId: string; error: string }) => void): UnsubscribeFn => {
      ipcRenderer.on('ultronos:voice:error', (_, ev) => cb(ev));
      return () => ipcRenderer.removeAllListeners('ultronos:voice:error');
    },
  },

  worktree: {
    create: (repoPath: string, agentId: string) =>
      ipcRenderer.invoke('ultronos:worktree:create', { repoPath, agentId }),
    list: (repoPath: string) => ipcRenderer.invoke('ultronos:worktree:list', { repoPath }),
    remove: (worktreePath: string, force?: boolean) =>
      ipcRenderer.invoke('ultronos:worktree:remove', { worktreePath, force }),
    prune: (repoPath: string) => ipcRenderer.invoke('ultronos:worktree:prune', { repoPath }),
    diff: (worktreePath: string, baseRef?: string) =>
      ipcRenderer.invoke('ultronos:worktree:diff', { worktreePath, baseRef }),
  },
};

contextBridge.exposeInMainWorld('ultronos', ultronos);

// TODO: replace all `window.ultronos.dataDir` sync getter calls with async `window.ultronos.getDataDir()`
// - no usages found in renderer/ at audit time (2026-04-21), but check if added later
