import { BrowserWindow, Tray, Menu, MenuItemConstructorOptions, ipcMain } from 'electron';
import { loadSettings, saveSettings, UltronosMode } from './settings';

export interface ModeConfig {
  id: UltronosMode;
  label: string;
  icon: string;
  plannerModel: string;
  workerModel: string;
  maxParallel: number;
  description: string;
}

export const MODES: Record<UltronosMode, ModeConfig> = {
  autopilot: {
    id: 'autopilot',
    label: 'Autopilot',
    icon: '✈️',
    plannerModel: 'claude-sonnet-4.6',
    workerModel: 'claude-sonnet-4.6',
    maxParallel: 3,
    description: 'Balanced, default mode (Sonnet × 1, max 3 parallel)',
  },
  ultrapilot: {
    id: 'ultrapilot',
    label: 'Ultrapilot',
    icon: '🚀',
    plannerModel: 'claude-opus-4.7',
    workerModel: 'claude-opus-4.7',
    maxParallel: 4,
    description: 'Maximum quality, aggressive parallelism (Opus × 1, max 4 parallel)',
  },
  swarm: {
    id: 'swarm',
    label: 'Swarm',
    icon: '🐝',
    plannerModel: 'claude-opus-4.7',
    workerModel: 'claude-sonnet-4.6',
    maxParallel: 6,
    description: 'Multi-agent decomposition (Opus planner + Sonnet workers, max 6 parallel)',
  },
  pipeline: {
    id: 'pipeline',
    label: 'Pipeline',
    icon: '⚙️',
    plannerModel: 'claude-sonnet-4.6',
    workerModel: 'claude-sonnet-4.6',
    maxParallel: 1,
    description: 'Sequential, careful steps (Sonnet × 1, max 1 parallel)',
  },
  eco: {
    id: 'eco',
    label: 'Eco',
    icon: '🌱',
    plannerModel: 'claude-haiku-4.5',
    workerModel: 'claude-haiku-4.5',
    maxParallel: 2,
    description: 'Fast & cheap (Haiku × 1, max 2 parallel)',
  },
};

export function getCurrentMode(): UltronosMode {
  const settings = loadSettings();
  return settings.mode;
}

export function setCurrentMode(mode: UltronosMode): void {
  if (!MODES[mode]) {
    console.warn(`[modeSwitcher] invalid mode: ${mode}`);
    return;
  }
  saveSettings({ mode });
}

export function getModeConfig(mode?: UltronosMode): ModeConfig {
  const m = mode ?? getCurrentMode();
  return MODES[m];
}

export function buildModeMenu(): MenuItemConstructorOptions[] {
  const current = getCurrentMode();

  return Object.values(MODES).map((config) => ({
    type: 'radio' as const,
    label: `${config.icon} ${config.label}`,
    checked: config.id === current,
    click: () => {
      setCurrentMode(config.id);
    },
  }));
}

export function registerModeIpc(tray: Tray, mainWindow: BrowserWindow): void {
  // Get current mode
  ipcMain.handle('ultronos:mode:get', () => {
    return getCurrentMode();
  });

  // Set current mode
  ipcMain.handle('ultronos:mode:set', (_, mode: string) => {
    if (!MODES[mode as UltronosMode]) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    setCurrentMode(mode as UltronosMode);
    // Broadcast to all windows
    const config = getModeConfig(mode as UltronosMode);
    mainWindow.webContents.send('ultronos:mode:changed', mode);
    // Update tray menu
    updateTrayMenu(tray, mainWindow);
    return config;
  });

  // Get all modes
  ipcMain.handle('ultronos:mode:list', () => {
    return Object.values(MODES);
  });

  // Get config for specific mode
  ipcMain.handle('ultronos:mode:config', (_, mode: string) => {
    if (!MODES[mode as UltronosMode]) {
      throw new Error(`Invalid mode: ${mode}`);
    }
    return getModeConfig(mode as UltronosMode);
  });

  // Update tray menu on startup
  updateTrayMenu(tray, mainWindow);
}

function updateTrayMenu(tray: Tray, mainWindow: BrowserWindow): void {
  const modeMenu = buildModeMenu();

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Ultronos',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Conductor Status…',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('ultronos:navigate', '/conductor');
      },
    },
    {
      label: 'Abort Overnight',
      click: () => {
        mainWindow.webContents.send('ultronos:conductor-abort');
      },
    },
    { type: 'separator' },
    {
      label: 'Mode',
      submenu: modeMenu,
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        const { app } = require('electron');
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}
