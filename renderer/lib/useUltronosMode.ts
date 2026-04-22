'use client';

import { useCallback, useEffect, useState } from 'react';

export type UltronosMode = 'autopilot' | 'ultrapilot' | 'swarm' | 'pipeline' | 'eco';

export interface ModeConfig {
  id: UltronosMode;
  label: string;
  icon: string;
  plannerModel: string;
  workerModel: string;
  maxParallel: number;
  description: string;
}

export function useUltronosMode() {
  const [mode, setModeState] = useState<UltronosMode>('autopilot');
  const [config, setConfig] = useState<ModeConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMode = async () => {
      try {
        if (typeof window !== 'undefined' && window.ultronos?.mode?.get) {
          const currentMode = await window.ultronos.mode.get();
          setModeState(currentMode);
          const cfg = await window.ultronos.mode.config(currentMode);
          setConfig(cfg);
        }
      } catch (e) {
        console.error('[useUltronosMode] failed to load', e);
      } finally {
        setLoading(false);
      }
    };

    loadMode();

    // Subscribe to changes
    if (typeof window !== 'undefined' && window.ultronos?.mode?.onChange) {
      const unsubscribe = window.ultronos.mode.onChange(async (newMode) => {
        const nextMode = newMode as UltronosMode;
        setModeState(nextMode);
        try {
          const cfg = await window.ultronos?.mode?.config(nextMode);
          if (cfg) setConfig(cfg);
        } catch (e) {
          console.error('[useUltronosMode] failed to load config for', nextMode, e);
        }
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    }
  }, []);

  const setMode = useCallback(
    async (newMode: UltronosMode): Promise<void> => {
      try {
        if (typeof window !== 'undefined' && window.ultronos?.mode?.set) {
          const cfg = await window.ultronos.mode.set(newMode);
          setModeState(newMode);
          setConfig(cfg);
        }
      } catch (e) {
        console.error('[useUltronosMode] failed to set mode', e);
        throw e;
      }
    },
    []
  );

  return {
    mode,
    setMode,
    config,
    loading,
  };
}
