import { BrowserWindow, ipcMain, Notification, app, Tray, Menu, globalShortcut, nativeImage, shell } from 'electron';

const broadcastToWindows = (channel: string, payload: unknown) => {
  BrowserWindow.getAllWindows().forEach((w) => {
    w.webContents.send(channel, payload);
  });
};
import * as path from 'path';
import * as fs from 'fs';
import { loadSettings, saveSettings, resetSettings, UltronosSettings, DEFAULT_SETTINGS } from './settings';
import { agentRegistry, AgentRuntime } from './agentRegistry';
import { readTranscript, clearTranscript, TranscriptEvent } from './persistence';
import { startListener, stopListener, restartListener, getListenerStatus } from './listenerManager';

type TrayStatus = 'idle' | 'working' | 'error';

let trayInstance: Tray | null = null;

function serializeRuntime(rt: AgentRuntime) {
  return {
    sessionId: rt.sessionId,
    agentId: rt.agentId,
    status: rt.status,
    pid: rt.pid,
    createdAt: rt.createdAt,
    lastActivity: rt.lastActivity,
  };
}

export function registerIpc(window: BrowserWindow): void {
  // Window controls
  ipcMain.handle('ultronos:window:minimize', () => {
    window.minimize();
  });

  ipcMain.handle('ultronos:window:maximize', () => {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  });

  ipcMain.handle('ultronos:window:close', () => {
    window.close();
  });

  ipcMain.handle('ultronos:window:is-maximized', (): boolean => {
    return window.isMaximized();
  });

  // Notifications
  ipcMain.on('ultronos:notify', (_, { title, body, urgency }: { title: string; body: string; urgency?: string }) => {
    const notification = new Notification({
      title,
      body,
      urgency: (urgency as 'low' | 'normal' | 'critical') || 'normal',
    });
    notification.show();
  });

  // Badge (platform-specific)
  ipcMain.on('ultronos:badge', (_, { count }: { count: number }) => {
    const platformType = process.platform;

    if (platformType === 'darwin' || platformType === 'linux') {
      app.setBadgeCount(count);
    } else if (platformType === 'win32') {
      // Windows: set overlay icon with dot if count > 0
      // For now, just set badge count (Windows doesn't use setBadgeCount, but setOverlayIcon with image)
      if (count > 0) {
        // You could load a small dot PNG from resources here
        // window.setOverlayIcon(path, label)
        // For now, skip — minimal visual feedback
      }
    }
  });

  // Tray
  ipcMain.on('ultronos:tray:tooltip', (_, { text }: { text: string }) => {
    if (trayInstance) {
      trayInstance.setToolTip(text);
    }
  });

  ipcMain.on('ultronos:tray:status', (_, { status }: { status: TrayStatus }) => {
    // Store status for visual indication (icon change would go here)
    // For now, just update tooltip to include status
    if (trayInstance) {
      trayInstance.setToolTip(`Ultronos · ${status}`);
    }
  });

  // Shell
  ipcMain.handle('ultronos:shell:open-external', async (_, { url }: { url: string }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error(`blocked protocol: ${parsed.protocol}`);
      }
      await shell.openExternal(url);
    } catch (e) {
      console.warn('[shell.openExternal] rejected', url, e);
    }
  });

  // Data dir (async)
  ipcMain.handle('ultronos:get-data-dir', () => app.getPath('userData'));

  // Settings — load/save/reset
  ipcMain.handle('ultronos:settings:get', (): UltronosSettings => loadSettings());
  ipcMain.handle('ultronos:settings:set', (_, patch: Partial<UltronosSettings>): UltronosSettings => {
    const next = saveSettings(patch);
    applySettingsToWindow(window, next);
    return next;
  });
  ipcMain.handle('ultronos:settings:reset', (): UltronosSettings => {
    const fresh = resetSettings();
    applySettingsToWindow(window, fresh);
    return fresh;
  });
  ipcMain.handle('ultronos:settings:defaults', (): UltronosSettings => DEFAULT_SETTINGS);

  // Zoom — fine-grained controls
  ipcMain.handle('ultronos:zoom:set', (_, { factor }: { factor: number }): number => {
    const clamped = Math.max(0.5, Math.min(2.5, factor));
    window.webContents.setZoomFactor(clamped);
    saveSettings({ zoomFactor: clamped });
    return clamped;
  });
  ipcMain.handle('ultronos:zoom:get', (): number => window.webContents.getZoomFactor());
  ipcMain.handle('ultronos:zoom:in', (): number => {
    const next = Math.min(2.5, window.webContents.getZoomFactor() + 0.1);
    window.webContents.setZoomFactor(next);
    saveSettings({ zoomFactor: next });
    return next;
  });
  ipcMain.handle('ultronos:zoom:out', (): number => {
    const next = Math.max(0.5, window.webContents.getZoomFactor() - 0.1);
    window.webContents.setZoomFactor(next);
    saveSettings({ zoomFactor: next });
    return next;
  });
  ipcMain.handle('ultronos:zoom:reset', (): number => {
    window.webContents.setZoomFactor(1.0);
    saveSettings({ zoomFactor: 1.0 });
    return 1.0;
  });

  // App info
  ipcMain.handle('ultronos:app:info', () => ({
    version: app.getVersion(),
    name: app.getName(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    userData: app.getPath('userData'),
  }));

  // Open folder in file explorer
  ipcMain.handle('ultronos:shell:open-path', async (_, { target }: { target: 'userData' | 'logs' | 'temp' }) => {
    const map: Record<string, string> = {
      userData: app.getPath('userData'),
      logs: app.getPath('logs'),
      temp: app.getPath('temp'),
    };
    const p = map[target];
    if (p) await shell.openPath(p);
  });

  // Relaunch app (after settings that require restart)
  ipcMain.handle('ultronos:app:relaunch', () => {
    app.relaunch();
    app.exit(0);
  });

  // === AGENT CONSOLE HANDLERS (Phase A) ===

  // Spawn new agent session
  ipcMain.handle(
    'ultronos:agent:spawn',
    (_, { agentId, opts }: { agentId: string; opts?: { systemPrompt?: string } }) => {
      const runtime = agentRegistry.spawnAgent(agentId, opts);
      return serializeRuntime(runtime);
    },
  );

  // Kill agent session
  ipcMain.handle('ultronos:agent:kill', async (_, { sessionId }: { sessionId: string }) => {
    const result = await agentRegistry.killAgent(sessionId);
    // Broadcast death event
    BrowserWindow.getAllWindows().forEach((w: BrowserWindow) => {
      w.webContents.send('ultronos:agent:status', {
        sessionId,
        status: 'dead',
        killed: result.killed,
        exitCode: result.exitCode,
      });
    });
    return result;
  });

  // Send input to agent (stdin)
  ipcMain.handle('ultronos:agent:input', async (_, { sessionId, text }: { sessionId: string; text: string }) => {
    try {
      const result = await agentRegistry.sendInput(sessionId, text);
      return result;
    } catch (e) {
      console.error(`[agent:input] failed:`, e);
      throw e;
    }
  });

  // List all active agent runtimes
  ipcMain.handle('ultronos:agent:list', () => {
    return agentRegistry.listRuntimes().map(serializeRuntime);
  });

  // Read transcript for a session
  ipcMain.handle('ultronos:agent:transcript', async (_, { sessionId, limit }: { sessionId: string; limit?: number }) => {
    try {
      return await readTranscript(sessionId, limit ?? 200);
    } catch (e) {
      console.error(`[agent:transcript] failed:`, e);
      throw e;
    }
  });

  // Clear transcript for a session
  ipcMain.handle('ultronos:agent:clear', async (_, { sessionId }: { sessionId: string }) => {
    try {
      await clearTranscript(sessionId);
      return { success: true };
    } catch (e) {
      console.error(`[agent:clear] failed:`, e);
      throw e;
    }
  });

  // Restart agent (kill + spawn new)
  ipcMain.handle('ultronos:agent:restart', async (_, { agentId }: { agentId: string }) => {
    try {
      const runtime = await agentRegistry.restartAgent(agentId);
      return serializeRuntime(runtime);
    } catch (e) {
      console.error(`[agent:restart] failed:`, e);
      throw e;
    }
  });

  // === LISTENER HANDLERS ===

  // Start TG listener
  ipcMain.handle('ultronos:listener:start', () => {
    console.log('[ipc] listener:start');
    startListener(window);
  });

  // Stop TG listener
  ipcMain.handle('ultronos:listener:stop', () => {
    console.log('[ipc] listener:stop');
    stopListener();
  });

  // Restart TG listener
  ipcMain.handle('ultronos:listener:restart', () => {
    console.log('[ipc] listener:restart');
    restartListener(window);
  });

  // Get listener status
  ipcMain.handle('ultronos:listener:status', () => {
    return getListenerStatus();
  });
}

export function applySettingsToWindow(window: BrowserWindow, s: UltronosSettings): void {
  try {
    window.webContents.setZoomFactor(s.zoomFactor);
    window.setAlwaysOnTop(s.alwaysOnTop);
  } catch (e) {
    console.error('[settings] apply failed', e);
  }
}

export function getInitialSettings(): UltronosSettings {
  return loadSettings();
}

export function initTray(window: BrowserWindow): Tray {
  const iconPath = path.join(__dirname, '..', 'resources', 'tray-icon.png');
  let icon;
  if (fs.existsSync(iconPath)) {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) icon = nativeImage.createEmpty();
  } else {
    // 16x16 transparent PNG built inline so Tray ctor doesn't throw on missing asset
    const transparent16 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAF0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64',
    );
    icon = nativeImage.createFromBuffer(transparent16);
  }

  trayInstance = new Tray(icon);
  trayInstance.setToolTip('Ultronos · idle');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Ultronos',
      click: () => {
        window.show();
        window.focus();
      },
    },
    {
      label: 'Conductor Status…',
      click: () => {
        window.show();
        window.focus();
        window.webContents.send('ultronos:navigate', '/conductor');
      },
    },
    {
      label: 'Abort Overnight',
      click: () => {
        window.webContents.send('ultronos:conductor-abort');
      },
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);

  trayInstance.setContextMenu(contextMenu);

  // Toggle window on tray click
  trayInstance.on('click', () => {
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
  });

  return trayInstance;
}

export function registerGlobalShortcuts(window: BrowserWindow): void {
  app.whenReady().then(() => {
    globalShortcut.register('CommandOrControl+Shift+U', () => {
      if (window.isVisible()) {
        window.hide();
      } else {
        window.show();
        window.focus();
      }
    });
  });
}

export function unregisterGlobalShortcuts(): void {
  globalShortcut.unregisterAll();
}
