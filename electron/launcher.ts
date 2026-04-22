import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';

let launcherWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

export function registerLauncher(main: BrowserWindow): void {
  mainWindow = main;

  // Register global hotkey: Cmd/Ctrl + Shift + Space
  try {
    globalShortcut.register('CommandOrControl+Shift+Space', () => {
      toggleLauncher();
    });
  } catch (e) {
    console.error('[launcher] Failed to register hotkey', e);
  }

  // IPC handlers
  ipcMain.handle('ultronos:launcher:hide', () => {
    if (launcherWindow) {
      launcherWindow.hide();
    }
  });

  ipcMain.handle('ultronos:launcher:execute', async (_, { action, args }: { action: string; args?: unknown }) => {
    switch (action) {
      case 'spawn-agent': {
        const agentId = args as string;
        if (mainWindow) {
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'spawn-agent', agentId });
          mainWindow.focus();
        }
        if (launcherWindow) {
          launcherWindow.hide();
        }
        break;
      }
      case 'kill-all': {
        if (mainWindow) {
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'kill-all' });
        }
        break;
      }
      case 'focus-main': {
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        if (launcherWindow) {
          launcherWindow.hide();
        }
        break;
      }
      case 'open-agents': {
        if (mainWindow) {
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'navigate', path: '/agents' });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        if (launcherWindow) {
          launcherWindow.hide();
        }
        break;
      }
      case 'open-conductor': {
        if (mainWindow) {
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'navigate', path: '/conductor' });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        if (launcherWindow) {
          launcherWindow.hide();
        }
        break;
      }
      case 'open-swarm': {
        if (mainWindow) {
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'navigate', path: '/swarm' });
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.focus();
        }
        if (launcherWindow) {
          launcherWindow.hide();
        }
        break;
      }
      case 'send-tg': {
        if (mainWindow) {
          const message = args as string;
          mainWindow.webContents.send('ultronos:launcher:action', { type: 'send-tg', message });
        }
        break;
      }
      default:
        console.warn('[launcher] Unknown action:', action);
    }
  });
}

export function unregisterLauncher(): void {
  globalShortcut.unregister('CommandOrControl+Shift+Space');
  if (launcherWindow) {
    launcherWindow.destroy();
    launcherWindow = null;
  }
}

function toggleLauncher(): void {
  if (!launcherWindow) {
    createLauncherWindow();
  } else if (launcherWindow.isVisible()) {
    launcherWindow.hide();
  } else {
    launcherWindow.show();
    launcherWindow.focus();
  }
}

function createLauncherWindow(): void {
  if (launcherWindow) {
    launcherWindow.show();
    launcherWindow.focus();
    return;
  }

  // Get primary display to center window
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const windowWidth = 720;
  const windowHeight = 480;
  const x = Math.round((width - windowWidth) / 2) + primaryDisplay.workArea.x;
  const y = Math.round((height - windowHeight) / 2) + primaryDisplay.workArea.y;

  launcherWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Hide on blur
  launcherWindow.on('blur', () => {
    if (launcherWindow && launcherWindow.isVisible()) {
      launcherWindow.hide();
    }
  });

  launcherWindow.on('closed', () => {
    launcherWindow = null;
  });

  // Load the launcher page
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    // In dev, load from http://localhost:3000/launcher (or whatever port Next.js uses)
    // The main window should pass the base URL from server startup
    launcherWindow.loadURL(`http://localhost:3000/launcher`);
  } else {
    // In prod, assume launcherWindow loads from same baseURL as mainWindow
    // This will be passed from createWindow context; for now, use a sensible default
    launcherWindow.loadURL(`http://localhost:3000/launcher`);
  }

  launcherWindow.show();
  launcherWindow.focus();
}
