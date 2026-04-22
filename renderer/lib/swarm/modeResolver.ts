import type { ModeConfig, UltronosMode } from '@/types/ultronos';

const DEFAULT_MODE_CONFIG: ModeConfig = {
  id: 'autopilot',
  label: 'Autopilot',
  icon: '✈️',
  plannerModel: 'claude-sonnet-4.6',
  workerModel: 'claude-sonnet-4.6',
  maxParallel: 3,
  description: 'Balanced, default mode',
};

let cachedModeConfig: ModeConfig | null = null;

export function getModeConfig(mode?: UltronosMode): ModeConfig {
  // If we're in Electron environment, try to get from IPC
  if (typeof window !== 'undefined' && window.ultronos?.mode?.config) {
    // For now, return cached or default
    // A real implementation would call window.ultronos.mode.config() async
    // but this is sync, so we'll use cache or default
    if (cachedModeConfig) {
      return cachedModeConfig;
    }
  }

  if (mode) {
    const configs = getModeConfigs();
    if (isDictionary(configs, mode)) {
      return configs[mode];
    }
  }

  return DEFAULT_MODE_CONFIG;
}

function isDictionary(dict: Record<string, unknown>, key: string): key is keyof typeof dict {
  return key in dict;
}

export function getModeConfigs(): Record<UltronosMode, ModeConfig> {
  return {
    autopilot: {
      id: 'autopilot',
      label: 'Autopilot',
      icon: '✈️',
      plannerModel: 'claude-sonnet-4.6',
      workerModel: 'claude-sonnet-4.6',
      maxParallel: 3,
      description: 'Balanced, default mode',
    },
    ultrapilot: {
      id: 'ultrapilot',
      label: 'Ultrapilot',
      icon: '🚀',
      plannerModel: 'claude-opus-4.7',
      workerModel: 'claude-opus-4.7',
      maxParallel: 4,
      description: 'Maximum quality, aggressive parallelism',
    },
    swarm: {
      id: 'swarm',
      label: 'Swarm',
      icon: '🐝',
      plannerModel: 'claude-opus-4.7',
      workerModel: 'claude-sonnet-4.6',
      maxParallel: 6,
      description: 'Multi-agent decomposition',
    },
    pipeline: {
      id: 'pipeline',
      label: 'Pipeline',
      icon: '⚙️',
      plannerModel: 'claude-sonnet-4.6',
      workerModel: 'claude-sonnet-4.6',
      maxParallel: 1,
      description: 'Sequential, careful steps',
    },
    eco: {
      id: 'eco',
      label: 'Eco',
      icon: '🌱',
      plannerModel: 'claude-haiku-4.5',
      workerModel: 'claude-haiku-4.5',
      maxParallel: 2,
      description: 'Fast & cheap',
    },
  };
}

export function setCachedModeConfig(config: ModeConfig): void {
  cachedModeConfig = config;
}
