export interface LauncherCommand {
  id: string;
  title: string;
  subtitle?: string;
  keywords?: string[];
  icon?: string;
  execute: () => Promise<void> | void;
}

// Agent definitions - will be populated from lib/agents.ts
export const AGENTS = [
  { id: 'uefn-verse', name: 'UEFN Verse' },
  { id: 'nextjs-shadcn', name: 'Next.js + shadcn' },
  { id: 'supabase-db', name: 'Supabase DB' },
  { id: 'telegram-automation', name: 'Telegram Automation' },
  { id: 'fortnite-analytics', name: 'Fortnite Analytics' },
  { id: 'memory-curator', name: 'Memory Curator' },
];

export function generateCommandsForAgents(): LauncherCommand[] {
  return AGENTS.map((agent) => ({
    id: `ask-${agent.id}`,
    title: `Ask ${agent.name}…`,
    subtitle: `Spawn ${agent.name} agent`,
    keywords: ['ask', 'spawn', agent.id.toLowerCase()],
    icon: '🤖',
    execute: async () => {
      await window.ultronos?.launcher.execute('spawn-agent', agent.id);
    },
  }));
}

export function generateBuiltInCommands(): LauncherCommand[] {
  return [
    {
      id: 'spawn-all-agents',
      title: 'Spawn all agents',
      subtitle: 'Start all 6 agents',
      keywords: ['spawn', 'all', 'agents', 'start'],
      icon: '⚙️',
      execute: async () => {
        for (const agent of AGENTS) {
          await window.ultronos?.launcher.execute('spawn-agent', agent.id);
        }
      },
    },
    {
      id: 'kill-all-agents',
      title: 'Kill all agents',
      subtitle: 'Stop all running agents',
      keywords: ['kill', 'stop', 'agents', 'terminate'],
      icon: '🔴',
      execute: async () => {
        await window.ultronos?.launcher.execute('kill-all');
      },
    },
    {
      id: 'open-agents',
      title: 'Open Agents',
      subtitle: 'Navigate to agents console',
      keywords: ['open', 'agents', 'console', 'dashboard'],
      icon: '📊',
      execute: async () => {
        await window.ultronos?.launcher.execute('open-agents');
      },
    },
    {
      id: 'open-conductor',
      title: 'Open Conductor',
      subtitle: 'Navigate to conductor',
      keywords: ['open', 'conductor', 'orchestrate'],
      icon: '🎼',
      execute: async () => {
        await window.ultronos?.launcher.execute('open-conductor');
      },
    },
    {
      id: 'open-swarm',
      title: 'Open Swarm',
      subtitle: 'Navigate to swarm mode',
      keywords: ['open', 'swarm', 'multi-agent'],
      icon: '🐝',
      execute: async () => {
        await window.ultronos?.launcher.execute('open-swarm');
      },
    },
    {
      id: 'focus-main',
      title: 'Focus main window',
      subtitle: 'Bring main window to front',
      keywords: ['focus', 'main', 'window', 'restore'],
      icon: '🪟',
      execute: async () => {
        await window.ultronos?.launcher.execute('focus-main');
      },
    },
  ];
}

export function getBuiltInCommands(): LauncherCommand[] {
  return [
    ...generateCommandsForAgents(),
    ...generateBuiltInCommands(),
  ];
}
