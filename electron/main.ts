import { app, BrowserWindow, shell, session, globalShortcut, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import { startNextServer, stopNextServer } from './server';
import { registerIpc, initTray, registerGlobalShortcuts, unregisterGlobalShortcuts, applySettingsToWindow, getInitialSettings } from './ipc';
import { loadSettings, saveSettings } from './settings';
import { startLiveFeed, stopLiveFeed } from './liveFeed';
import { startListener, stopListener } from './listenerManager';
import { registerWin11AiIpc } from './win11ai';
import { registerLauncher, unregisterLauncher } from './launcher';
import { registerModeIpc } from './modeSwitcher';
import { registerVoiceIpc, cleanupVoiceOnQuit } from './voiceInput';
import { registerWorktreeIpc } from './worktreeIpc';

const isDev = process.env.NODE_ENV === 'development';
const isMac = process.platform === 'darwin';
let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let ipcRegistered = false;

function createWindow(url: string): void {
  const preloadPath = path.join(__dirname, 'preload.js');

  const windowConfig: BrowserWindowConstructorOptions = {
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    frame: false,
    titleBarStyle: 'hidden' as const,
    backgroundColor: '#05070d',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };

  // Platform-specific styling
  if (isMac) {
    Object.assign(windowConfig, {
      vibrancy: 'under-window' as const,
      titleBarStyle: 'hiddenInset' as const,
    });
  } else if (process.platform === 'win32') {
    Object.assign(windowConfig, {
      backgroundMaterial: 'acrylic' as const,
    });
  }

  mainWindow = new BrowserWindow(windowConfig);

  // Handle window maximize/unmaximize
  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('ultronos:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('ultronos:maximized-change', false);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // invalid URL — silently ignore
    }
    return { action: 'deny' };
  });

  mainWindow.loadURL(url);

  const settings = loadSettings();

  mainWindow.once('ready-to-show', () => {
    if (!settings.startMinimized) {
      mainWindow?.show();
    }
    applySettingsToWindow(mainWindow!, settings);
  });

  mainWindow.webContents.once('did-finish-load', () => {
    if (mainWindow) {
      startLiveFeed(mainWindow);
    }
  });

  // Close → hide to tray if enabled (instead of quitting)
  mainWindow.on('close', (e) => {
    const s = loadSettings();
    if (s.hideToTrayOnClose && !isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Open DevTools in dev mode
  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

function setupCSP(): void {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self' http://127.0.0.1:*; " +
            "style-src 'self' 'unsafe-inline' http://127.0.0.1:*; " +
            "img-src 'self' data: http://127.0.0.1:* https:; " +
            "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; " +
            "font-src 'self' data: http://127.0.0.1:*;",
        ],
      },
    });
  });
}

async function initApp(): Promise<void> {
  await app.whenReady();

  // Set app ID for Windows
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.dima.ultronos');
  }

  // Setup CSP
  setupCSP();

  // Start Next.js server
  let serverUrl: string;
  try {
    serverUrl = await startNextServer();
    console.log(`Started Next.js server at ${serverUrl}`);
  } catch (error) {
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Server Error',
      `Failed to start Next.js server: ${error instanceof Error ? error.message : String(error)}`
    );
    app.quit();
    return;
  }

  // Create main window
  createWindow(serverUrl);

  // Register IPC (idempotent — handlers survive window close on macOS)
  if (mainWindow) {
    if (!ipcRegistered) {
      registerIpc(mainWindow);
      registerWin11AiIpc();
      registerVoiceIpc(mainWindow);
      registerWorktreeIpc();
      ipcRegistered = true;
    }
    const tray = initTray(mainWindow);
    registerModeIpc(tray, mainWindow);
    registerGlobalShortcuts(mainWindow);
    registerLauncher(mainWindow);

    // Auto-start TG listener if enabled
    const settings = loadSettings();
    if (settings.autoStartListener) {
      console.log('[main] auto-starting TG listener');
      startListener(mainWindow);
    }
  }
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // Initialize app
  initApp();
}

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (!isMac) {
    app.quit();
  }
});

// Re-create window when dock icon is clicked (macOS)
app.on('activate', () => {
  if (mainWindow === null) {
    app.whenReady().then(() => {
      startNextServer()
        .then((url) => {
          createWindow(url);
          if (mainWindow) {
            // IPC handlers persist — don't re-register (would throw on duplicate handle())
            const tray = initTray(mainWindow);
            registerModeIpc(tray, mainWindow);
            registerGlobalShortcuts(mainWindow);
            startLiveFeed(mainWindow);
          }
        })
        .catch((error) => {
          console.error('Failed to restart server:', error);
        });
    });
  }
});

// Cleanup on quit
app.on('before-quit', async () => {
  isQuitting = true;
  stopLiveFeed();
  stopNextServer();
  stopListener();
  cleanupVoiceOnQuit();
  unregisterGlobalShortcuts();
  unregisterLauncher();
  globalShortcut.unregisterAll();
});

// Zoom shortcuts (local to focused window)
app.whenReady().then(() => {
  const registerZoom = () => {
    globalShortcut.register('CommandOrControl+=', () => {
      if (!mainWindow) return;
      const next = Math.min(2.5, mainWindow.webContents.getZoomFactor() + 0.1);
      mainWindow.webContents.setZoomFactor(next);
      saveSettings({ zoomFactor: next });
    });
    globalShortcut.register('CommandOrControl+-', () => {
      if (!mainWindow) return;
      const next = Math.max(0.5, mainWindow.webContents.getZoomFactor() - 0.1);
      mainWindow.webContents.setZoomFactor(next);
      saveSettings({ zoomFactor: next });
    });
    globalShortcut.register('CommandOrControl+0', () => {
      if (!mainWindow) return;
      mainWindow.webContents.setZoomFactor(1.0);
      saveSettings({ zoomFactor: 1.0 });
    });
  };
  registerZoom();
});
