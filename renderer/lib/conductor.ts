export type AgentId = "ultron" | "nova" | "forge" | "ares" | "echo" | "midas";

export const AGENT_IDS: AgentId[] = ["ultron", "nova", "forge", "ares", "echo", "midas"];

export type Pillar = {
  agentId: AgentId;
  name: string;
  ownedPaths: string[];
  examples: string[];
};

export const PILLARS: Record<AgentId, Pillar> = {
  ultron: {
    agentId: "ultron",
    name: "Meta / Orchestration",
    ownedPaths: ["app/api/bridge/**", "lib/orchestration/**", "components/bridge/**"],
    examples: [
      "Command palette v2",
      "Global macros",
      "Keybinding editor",
      "Session replayer",
      "Multi-agent RoomChat",
    ],
  },
  nova: {
    agentId: "nova",
    name: "Knowledge & Search",
    ownedPaths: ["app/api/search/**", "lib/search/**", "components/search/**"],
    examples: [
      "NL-search across MemoryGalaxy+chat",
      "Citation graph",
      "Tag extraction",
      "RAG-lite over vault",
    ],
  },
  forge: {
    agentId: "forge",
    name: "New Panels & Theming",
    ownedPaths: [
      "app/api/theme/**",
      "lib/theme/**",
      "components/theme/**",
      "components/panels/**",
    ],
    examples: [
      "ThemeSwitcher",
      "LayoutEditor",
      "CosmosBackground",
      "Timezone/weather panel",
      "UI-preset library",
    ],
  },
  ares: {
    agentId: "ares",
    name: "Self-test & Self-heal",
    ownedPaths: ["tests/**", "lib/selftest/**", "app/api/selftest/**"],
    examples: [
      "Property-based tests (fast-check)",
      "Playwright e2e",
      "Mutation testing",
      "Error-boundary coverage",
    ],
  },
  echo: {
    agentId: "echo",
    name: "Integrations",
    ownedPaths: [
      "app/api/integrations/**",
      "lib/integrations/**",
      "components/integrations/**",
    ],
    examples: [
      "GitHub status",
      "Webhook inbox",
      "Telegram rich UI v2",
      "Crypto/market feed",
      "Uptime pinger",
    ],
  },
  midas: {
    agentId: "midas",
    name: "Analytics & Insights",
    ownedPaths: ["app/api/analytics/**", "lib/analytics/**", "components/analytics/**"],
    examples: [
      "Cost dashboard",
      "Session stats",
      "Profile insights with charts",
      "Tool-use heatmap",
    ],
  },
};

export const PROTECTED_PATHS: string[] = [
  ".env",
  ".env.local",
  ".env.*",
  "node_modules/",
  ".next/",
  "package.json",
  "package-lock.json",
  "bun.lock",
  "tsconfig.tsbuildinfo",
  "lib/agents.ts",
  "app/api/chat/**",
  "app/api/conductor/**",
  ".overnight-plan/**",
  ".claude/**",
];

export const SHARED_LOCK_FILES: string[] = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
];

export type SlotMode = "extend" | "polish" | "stabilization";

export type AgentBrief = {
  agentId: AgentId;
  title: string;
  mode: SlotMode;
  instructions: string;
  scoutIdeas?: ScoutIdea[];
};

export type Slot = {
  index: number;
  startsAt: string;
  mode: SlotMode;
  briefs: Record<AgentId, AgentBrief | null>;
  status: "pending" | "running" | "completed" | "skipped" | "reverted";
  gate?: GateVerdict;
  retro?: SlotRetro;
};

export type Plan = {
  createdAt: string;
  projectRoot: string;
  vision: string;
  visionLog: Array<{ ts: string; note: string; by: "conductor" | "replan" | "reground" }>;
  skeleton: Record<AgentId, { title: string; seeds: string[] }>;
  slotCount: number;
  currentSlot: number;
  slots: Slot[];
  degraded: boolean;
  redStreak: number;
  revisionLog: Array<{ ts: string; slot: number; by: string; note: string }>;
  scoutActive: boolean;
  aborted: boolean;
};

export type GateVerdict = {
  ts: string;
  slot: number;
  tscClean: boolean;
  tscOutputTail: string;
  testsPass: boolean;
  vitestOutputTail: string;
  devServerAlive: boolean;
  overall: "green" | "red";
};

export type RetroEntry = {
  agentId: AgentId;
  filesTouched: string[];
  summary: string;
  blockers: string[];
  confidence: number;
  toolCalls: number;
  durationMs: number;
};

export type SlotRetro = {
  slot: number;
  ts: string;
  entries: Record<AgentId, RetroEntry | null>;
  greenCount: number;
  redCount: number;
};

export type ScoutIdea = {
  ts: string;
  pillar: AgentId | "any";
  idea: string;
  sourceUrl?: string;
  rank: number;
  tags: string[];
};

export const DEFAULTS = {
  SLOT_MS: 30 * 60 * 1000,
  SLOT_COUNT: 22,
  WAVES: 3,
  AGENT_TIMEOUT_MS: 22 * 60 * 1000,
  GATE_TIMEOUT_MS: 7 * 60 * 1000,
  HEARTBEAT_STALE_MS: 40 * 60 * 1000,
  LOCK_STALE_MS: 31 * 60 * 1000,
  SCOUT_CYCLE_MS: 15 * 60 * 1000,
  SCOUT_MAX_IDEAS_PER_CYCLE: 20,
  DISK_MIN_FREE_GB: 2,
  MAX_TURNS: 80,
} as const;

export const WAVES: Array<[AgentId, AgentId]> = [
  ["ultron", "nova"],
  ["forge", "ares"],
  ["echo", "midas"],
];
