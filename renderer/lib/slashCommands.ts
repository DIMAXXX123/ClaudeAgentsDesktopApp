/**
 * Slash command pattern matcher for voice input.
 * Matches natural language Russian/English commands and converts to structured slash commands.
 */

export interface SlashCommand {
  cmd: string;
  target?: string;
  args?: Record<string, string>;
}

type PatternHandler = (match: RegExpMatchArray) => SlashCommand;

const PATTERNS: Array<[RegExp, PatternHandler]> = [
  // Debug/Fix patterns
  [
    /^(пофикси|fix|debug)(?:\s+(баг|bug))?\s+(?:в\s+)?(\w+)/i,
    (m) => ({ cmd: '/debug', target: m[3] || 'auth' }),
  ],

  // Spawn/Launch patterns
  [
    /^(запусти|spawn|launch|start)\s+(?:agent\s+)?(\w+)/i,
    (m) => ({ cmd: '/spawn', target: m[2] }),
  ],

  // Swarm/Parallel patterns
  [/^(свопи|swarm|parallel)\s+(.+)/i, (m) => ({ cmd: '/swarm', target: m[2] })],

  // Run/Execute patterns
  [
    /^(запусти|run|execute)\s+(?:script|скрипт)?\s+(.+)/i,
    (m) => ({ cmd: '/run', target: m[2] }),
  ],

  // Kill/Stop patterns
  [
    /^(убей|kill|stop|остановь)\s+(?:agent\s+)?(\w+)/i,
    (m) => ({ cmd: '/kill', target: m[2] }),
  ],

  // Status/Info patterns
  [
    /^(статус|status|info|information)\s+(?:о\s+)?(\w+)?/i,
    (m) => ({ cmd: '/status', target: m[2] || 'all' }),
  ],

  // Clear/Reset patterns
  [
    /^(очисти|clear|reset)\s+(?:сессию|session)?\s+(\w+)/i,
    (m) => ({ cmd: '/clear', target: m[2] }),
  ],

  // Restart patterns
  [
    /^(перезапусти|restart|relaunch)\s+(?:agent\s+)?(\w+)/i,
    (m) => ({ cmd: '/restart', target: m[2] }),
  ],

  // List/Show patterns
  [/^(список|list|show|покажи)\s+(\w+)/i, (m) => ({ cmd: '/list', target: m[2] })],

  // Help patterns
  [
    /^(помощь|help|что\s+делать|wtf|help\s+me)/i,
    (_) => ({ cmd: '/help' }),
  ],

  // Plan patterns
  [
    /^(план|plan|спланируй|планируй)\s+(.+)/i,
    (m) => ({ cmd: '/plan', target: m[2] }),
  ],

  // Skip/Undo patterns
  [
    /^(пропусти|skip|undo|отмени)\s+(.+)?/i,
    (m) => ({ cmd: '/skip', target: m[2] || 'last' }),
  ],

  // Pause patterns
  [/^(пауза|pause|hold)/i, (_) => ({ cmd: '/pause' })],

  // Resume patterns
  [/^(продолжи|resume|continue)/i, (_) => ({ cmd: '/resume' })],

  // Settings patterns
  [
    /^(настройка|settings|config|установи)\s+(\w+)\s+(.+)/i,
    (m) => ({ cmd: '/config', args: { key: m[2], value: m[3] } }),
  ],

  // Transcription patterns (meta)
  [
    /^(транскрибируй|transcribe|запиши|record)\s+(.+)/i,
    (m) => ({ cmd: '/transcribe', target: m[2] }),
  ],

  // Model switch patterns
  [
    /^(переключись|switch|use|используй)\s+(?:model|модель)?\s+(\w+)/i,
    (m) => ({ cmd: '/model', target: m[2] }),
  ],

  // Agent input (default: pass directly to active session)
  [
    /^(.+)$/,
    (m) => ({
      cmd: '/input',
      target: m[1],
    }),
  ],
];

/**
 * Parse voice transcript into structured slash command.
 * Returns the first matching pattern, or /input with the raw text as fallback.
 */
export function parseSlashCommand(transcript: string): SlashCommand {
  const trimmed = transcript.trim();

  for (const [pattern, handler] of PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      try {
        return handler(match);
      } catch (e) {
        console.warn(`[slashCommands] handler error for pattern ${pattern}:`, e);
      }
    }
  }

  // Fallback: treat as direct input
  return {
    cmd: '/input',
    target: trimmed,
  };
}

/**
 * Execute slash command via IPC or HTTP.
 * For agent commands, routes to active session.
 * For system commands, can trigger UI actions.
 */
export async function executeSlashCommand(
  command: SlashCommand,
  sessionId?: string
): Promise<unknown> {
  const { cmd, target, args } = command;

  switch (cmd) {
    case '/input':
      // Direct agent input
      if (!sessionId) throw new Error('No active session for /input');
      return fetch('/api/agent/input', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, text: target }),
      });

    case '/debug':
      // Debug a component
      return fetch('/api/debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, sessionId }),
      });

    case '/spawn':
      // Spawn new agent
      return fetch('/api/agent/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: target }),
      });

    case '/kill':
      // Kill agent session
      if (!sessionId) throw new Error('No session ID for /kill');
      return fetch('/api/agent/kill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

    case '/swarm':
      // Parallel execution
      return fetch('/api/swarm/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskDescription: target, sessionId }),
      });

    case '/run':
      // Execute script
      return fetch('/api/exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: target, sessionId }),
      });

    case '/status':
      // Get status
      return fetch(`/api/agent/status?target=${encodeURIComponent(target || 'all')}`);

    case '/clear':
      // Clear session
      if (!sessionId) throw new Error('No session ID for /clear');
      return fetch('/api/agent/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

    case '/restart':
      // Restart agent
      return fetch('/api/agent/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: target }),
      });

    case '/list':
      // List resources
      return fetch(`/api/list?type=${encodeURIComponent(target || 'all')}`);

    case '/help':
      // Show help (client-side)
      return Promise.resolve({
        help: 'Available commands: /debug, /spawn, /kill, /swarm, /run, /status, /clear, /restart',
      });

    case '/plan':
      // Create plan
      return fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: target, sessionId }),
      });

    case '/pause':
      // Pause execution
      if (!sessionId) throw new Error('No session ID for /pause');
      return fetch('/api/agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

    case '/resume':
      // Resume execution
      if (!sessionId) throw new Error('No session ID for /resume');
      return fetch('/api/agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

    case '/model':
      // Switch model
      return fetch('/api/config/model', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: target }),
      });

    case '/config':
      // Update config
      return fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...args, sessionId }),
      });

    default:
      console.warn(`[slashCommands] unknown command: ${cmd}`);
      throw new Error(`Unknown command: ${cmd}`);
  }
}
