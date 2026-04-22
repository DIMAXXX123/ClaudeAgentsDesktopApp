import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export type UltronosMode = 'autopilot' | 'ultrapilot' | 'swarm' | 'pipeline' | 'eco';

export type UltronosSettings = {
  zoomFactor: number;
  alwaysOnTop: boolean;
  startMinimized: boolean;
  hideToTrayOnClose: boolean;
  launchOnStartup: boolean;
  desktopNotifications: boolean;
  soundEffects: boolean;
  theme: 'cyberpunk' | 'dark' | 'midnight';
  scanlinesIntensity: 'off' | 'subtle' | 'normal' | 'heavy';
  reduceMotion: boolean;
  autoStartListener: boolean;
  mode: UltronosMode;
};

export const DEFAULT_SETTINGS: UltronosSettings = {
  zoomFactor: 1.0,
  alwaysOnTop: false,
  startMinimized: false,
  hideToTrayOnClose: true,
  launchOnStartup: false,
  desktopNotifications: true,
  soundEffects: true,
  theme: 'cyberpunk',
  scanlinesIntensity: 'normal',
  reduceMotion: false,
  autoStartListener: true,
  mode: 'autopilot',
};

let cache: UltronosSettings | null = null;

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): UltronosSettings {
  if (cache) return cache;
  try {
    const raw = fs.readFileSync(settingsPath(), 'utf8');
    const parsed = JSON.parse(raw) as Partial<UltronosSettings>;
    cache = { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    cache = { ...DEFAULT_SETTINGS };
  }
  return cache;
}

export function saveSettings(patch: Partial<UltronosSettings>): UltronosSettings {
  const current = loadSettings();
  const next = { ...current, ...patch };
  cache = next;
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] save failed', e);
  }
  return next;
}

export function resetSettings(): UltronosSettings {
  cache = { ...DEFAULT_SETTINGS };
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(cache, null, 2), 'utf8');
  } catch (e) {
    console.error('[settings] reset failed', e);
  }
  return cache;
}
