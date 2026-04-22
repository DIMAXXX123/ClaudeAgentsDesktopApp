export type UltronosMode = 'autopilot' | 'ultrapilot' | 'swarm' | 'pipeline' | 'eco';

export interface ModeConfig {
  id: UltronosMode;
  label: string;
  icon: string;
  plannerModel: string;
  workerModel: string;
  maxParallel: number;
  description: string;
}

export interface UltronosSettings {
  zoomFactor: number;
  theme: "cyberpunk" | "dark" | "midnight";
  scanlinesIntensity: "off" | "subtle" | "normal" | "heavy";
  reduceMotion: boolean;
  alwaysOnTop: boolean;
  startMinimized: boolean;
  hideToTrayOnClose: boolean;
  launchOnStartup: boolean;
  desktopNotifications: boolean;
  soundEffects: boolean;
  autoStartListener: boolean;
  mode: UltronosMode;
}

export interface ListenerStatus {
  status: "idle" | "starting" | "connected" | "error" | "stopped";
  restartCount: number;
  lastError: string | null;
}

export interface ListenerLogEntry {
  line: string;
  level: "info" | "warning" | "error";
  timestamp: string;
}

export interface ListenerStatusEvent {
  status: "idle" | "starting" | "connected" | "error" | "stopped";
  error?: string;
  restartCount: number;
  timestamp: string;
}

export interface TranscriptEvent {
  ts: number;
  kind: "stdout" | "stderr" | "input" | "event" | "status";
  data: string;
  role?: "user" | "assistant" | "system";
}

export interface AgentRuntime {
  sessionId: string;
  agentId: string;
  status: "spawning" | "running" | "idle" | "error" | "dead";
  pid: number | null;
  createdAt: number;
  lastActivity: number;
}

export interface UltronosAppInfo {
  version: string;
  name: string;
  copyright?: string;
  homepage?: string;
  userData: string;
  electronVersion: string;
  nodeVersion: string;
  chromeVersion: string;
  platform: "win32" | "darwin" | "linux";
  arch: string;
}

declare global {
  interface Window {
    ultronos?: {
      notify: (title: string, body: string, urgency?: "low" | "normal" | "critical") => void;
      getDataDir: () => Promise<string>;
      settings: {
        get: () => Promise<UltronosSettings>;
        set: (patch: Partial<UltronosSettings>) => Promise<UltronosSettings>;
        reset: () => Promise<UltronosSettings>;
      };
      app: {
        info: () => Promise<UltronosAppInfo>;
        relaunch: () => Promise<void>;
      };
      shell: {
        openPath: (target: "userData" | "logs" | "temp") => Promise<void>;
        openExternal: (url: string) => Promise<void>;
      };
      zoom: {
        get: () => Promise<number>;
        set: (factor: number) => Promise<number>;
        in: () => Promise<number>;
        out: () => Promise<number>;
        reset: () => Promise<number>;
      };
      windowControls: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
      onMaximizedChange: (callback: (isMax: boolean) => void) => void;
      platform: "win32" | "darwin" | "linux";
      feed: {
        on(channel: string, cb: (data: unknown) => void): () => void;
      };
      listener: {
        start: () => Promise<void>;
        stop: () => Promise<void>;
        restart: () => Promise<void>;
        getStatus: () => Promise<ListenerStatus>;
        onLog: (cb: (ev: ListenerLogEntry) => void) => () => void;
        onStatus: (cb: (ev: ListenerStatusEvent) => void) => () => void;
      };
      agent: {
        spawn: (agentId: string, opts?: { systemPrompt?: string }) => Promise<AgentRuntime>;
        kill: (sessionId: string) => Promise<{ killed: boolean; exitCode: number | null }>;
        input: (sessionId: string, text: string) => Promise<{ written: number }>;
        list: () => Promise<AgentRuntime[]>;
        transcript: (sessionId: string, limit?: number) => Promise<TranscriptEvent[]>;
        clear: (sessionId: string) => Promise<void>;
        restart: (agentId: string) => Promise<AgentRuntime>;
        onOutput: (cb: (ev: unknown) => void) => () => void;
        onStatus: (cb: (ev: { sessionId: string; status: "spawning" | "running" | "idle" | "error" | "dead" }) => void) => () => void;
      };
      launcher: {
        hide: () => Promise<void>;
        execute: (action: string, args?: unknown) => Promise<unknown>;
      };
      win11ai: {
        available: () => Promise<boolean>;
        ocr: (imagePath: string) => Promise<{ text: string; lines?: Array<{ text: string; bbox?: unknown }> } | { error: string; detail?: string }>;
        summarize: (text: string) => Promise<{ summary: string } | { error: string; detail?: string }>;
        describe: (imagePath: string) => Promise<{ description: string } | { error: string; detail?: string }>;
        generate: (prompt: string) => Promise<{ text: string } | { error: string; detail?: string }>;
      };
      mode: {
        get: () => Promise<UltronosMode>;
        set: (mode: UltronosMode) => Promise<ModeConfig>;
        list: () => Promise<ModeConfig[]>;
        config: (mode: UltronosMode) => Promise<ModeConfig>;
        onChange: (cb: (mode: UltronosMode) => void) => () => void;
      };
      voice: {
        start: (recordingId: string) => Promise<{ recordingId: string }>;
        stop: (recordingId: string, audioData: Uint8Array) => Promise<{ transcript: string; duration: number; recordingId: string }>;
        transcribe: (recordingId: string, audioData: Uint8Array) => Promise<{ transcript: string; duration: number; recordingId: string }>;
        sendToAgent: (sessionId: string, transcript: string) => Promise<{ sent: boolean }>;
        onPartial: (cb: (ev: { recordingId: string; partial: string }) => void) => () => void;
        onComplete: (cb: (ev: { recordingId: string; transcript: string; duration: number }) => void) => () => void;
        onError: (cb: (ev: { recordingId: string; error: string }) => void) => () => void;
      };
      worktree: {
        create: (repoPath: string, agentId: string) => Promise<{ success: boolean; data?: { worktreePath: string; branch: string }; error?: string }>;
        list: (repoPath: string) => Promise<{ success: boolean; data?: Array<{ path: string; branch: string; agentId?: string; createdAt: string; hasChanges?: boolean }>; error?: string }>;
        remove: (worktreePath: string, force?: boolean) => Promise<{ success: boolean; error?: string }>;
        prune: (repoPath: string) => Promise<{ success: boolean; data?: { pruned: number }; error?: string }>;
        diff: (worktreePath: string, baseRef?: string) => Promise<{ success: boolean; data?: { diff: string }; error?: string }>;
      };
    };
  }
}

export {};
