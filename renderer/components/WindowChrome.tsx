'use client';

import { ReactNode, useEffect, useState, createContext, useContext } from 'react';

interface WindowState {
  isMaximized: boolean;
  platform: 'win32' | 'darwin' | 'linux' | 'unknown';
}

const WindowStateContext = createContext<WindowState>({
  isMaximized: false,
  platform: 'unknown',
});

export function useWindowState() {
  return useContext(WindowStateContext);
}

export function WindowChrome({ children }: { children: ReactNode }) {
  const [windowState, setWindowState] = useState<WindowState>({
    isMaximized: false,
    platform: 'unknown',
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.ultronos) return;

    const platform = window.ultronos.platform || 'unknown';
    window.ultronos.windowControls.isMaximized().then((isMax) => {
      setWindowState({ isMaximized: isMax, platform });
    });

    const unsubscribe = window.ultronos.onMaximizedChange((isMax) => {
      setWindowState((prev) => ({ ...prev, isMaximized: isMax }));
    });

    return unsubscribe;
  }, []);

  const isMacOS = windowState.platform === 'darwin';
  const borderRadius = windowState.isMaximized ? '0px' : '12px';

  return (
    <WindowStateContext.Provider value={windowState}>
      <div
        style={{
          borderRadius: isMacOS ? '0px' : borderRadius,
          transition: 'border-radius 0.2s ease-out',
        }}
        className="h-screen w-screen overflow-hidden bg-bg-base"
      >
        {children}
      </div>
    </WindowStateContext.Provider>
  );
}
