'use client';

import { useEffect, useState } from 'react';
import { TitleBar } from './TitleBar';
import { uiEventBus } from '@/lib/uiEventBus';
import { useAnyActivity } from '@/lib/activityStore';

interface TitleBarHostProps {
  onOpenPalette: () => void;
  onOpenMemory: () => void;
  onOpenSettings?: () => void;
  onOpenGalaxy?: () => void;
}

export function TitleBarHost({ onOpenPalette, onOpenMemory, onOpenSettings, onOpenGalaxy }: TitleBarHostProps) {
  const activity = useAnyActivity();
  const [conductorPhase, setConductorPhase] = useState<string | null>(null);

  useEffect(() => {
    const unsubPalette = uiEventBus.onOpenPalette(onOpenPalette);
    const unsubMemory = uiEventBus.onOpenMemory(onOpenMemory);
    const unsubSettings = onOpenSettings ? uiEventBus.onOpenSettings(onOpenSettings) : () => {};
    const unsubGalaxy = onOpenGalaxy ? uiEventBus.onOpenGalaxy(onOpenGalaxy) : () => {};
    return () => {
      unsubPalette();
      unsubMemory();
      unsubSettings();
      unsubGalaxy();
    };
  }, [onOpenPalette, onOpenMemory, onOpenSettings, onOpenGalaxy]);

  const workingIds = Object.entries(activity)
    .filter(([, v]) => v === 'working')
    .map(([k]) => k);

  const erroredIds = Object.entries(activity)
    .filter(([, v]) => v === 'error')
    .map(([k]) => k);

  let conductorStatus: 'idle' | 'working' | 'error' = 'idle';
  if (erroredIds.length > 0) {
    conductorStatus = 'error';
  } else if (workingIds.length > 0) {
    conductorStatus = 'working';
  }

  return (
    <TitleBar
      conductorStatus={conductorStatus}
      conductorPhase={conductorPhase}
      onOpenPalette={onOpenPalette}
      onOpenMemory={onOpenMemory}
      onOpenSettings={onOpenSettings}
      onOpenGalaxy={onOpenGalaxy}
    />
  );
}
