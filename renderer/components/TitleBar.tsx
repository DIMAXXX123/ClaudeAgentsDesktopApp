'use client';

import { useEffect, useRef } from 'react';
import { Minus, Square, X, Settings, Sparkles } from 'lucide-react';
import { useWindowState } from './WindowChrome';

interface TitleBarProps {
  conductorStatus?: 'idle' | 'working' | 'error';
  conductorPhase?: string | null;
  onOpenPalette?: () => void;
  onOpenMemory?: () => void;
  onOpenSettings?: () => void;
  onOpenGalaxy?: () => void;
}

export function TitleBar({
  conductorStatus = 'idle',
  conductorPhase = null,
  onOpenPalette,
  onOpenMemory,
  onOpenSettings,
  onOpenGalaxy,
}: TitleBarProps) {
  const { platform, isMaximized } = useWindowState();
  const marqueeRef = useRef<HTMLDivElement>(null);

  const isMacOS = platform === 'darwin';
  const barHeight = isMacOS ? 'h-7' : 'h-9';
  const contentPaddingLeft = isMacOS ? 'pl-20' : 'pl-4';

  const statusColors = {
    idle: 'bg-emerald-400',
    working: 'bg-amber-400',
    error: 'bg-red-500',
  };

  const statusLabels = {
    idle: 'READY',
    working: 'WORKING',
    error: 'ERROR',
  };

  const handleMinimize = () => {
    if (typeof window === 'undefined' || !window.ultronos) return;
    window.ultronos.windowControls.minimize();
  };

  const handleMaximize = () => {
    if (typeof window === 'undefined' || !window.ultronos) return;
    window.ultronos.windowControls.maximize();
  };

  const handleClose = () => {
    if (typeof window === 'undefined' || !window.ultronos) return;
    window.ultronos.windowControls.close();
  };

  return (
    <div
      className={`titlebar-drag ${barHeight} relative z-50 flex shrink-0 items-center justify-between border-b border-white/10 bg-[#05070d]/95 backdrop-blur-md`}
    >
      <div className="titlebar-drag flex items-center gap-3 px-4">
        <div className="pixel text-[10px] tracking-[0.2em] text-cyan-400 [text-shadow:_0_0_8px_#06b6d4]">
          ▲ ULTRONOS
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${statusColors[conductorStatus]} ${
              conductorStatus === 'working' ? 'animate-pulse' : ''
            }`}
          />
          <span className="font-mono text-[9px] uppercase tracking-widest text-white/60">
            {statusLabels[conductorStatus]}
          </span>
        </div>
      </div>

      <div className="titlebar-drag hidden flex-1 items-center justify-center md:flex">
        {conductorPhase && (
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[9px] text-white/40">
            {conductorPhase}
          </div>
        )}
        <div className="ml-4 text-[8px] uppercase tracking-[0.15em] text-white/40 opacity-40">
          ⌘K PALETTE · ⌘M MEMORY
        </div>
      </div>

      {!isMacOS && (
        <div className="titlebar-no-drag flex items-center gap-0">
          <button
            onClick={onOpenGalaxy}
            className="flex h-8 w-9 items-center justify-center border-l border-white/10 transition hover:bg-cyan-400/20 hover:text-cyan-400"
            aria-label="Memory Galaxy"
            title="Memory Galaxy (Ctrl+G)"
          >
            <Sparkles size={14} strokeWidth={2} />
          </button>
          <button
            onClick={onOpenSettings}
            className="flex h-8 w-9 items-center justify-center border-l border-white/10 transition hover:bg-cyan-400/20 hover:text-cyan-400"
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={14} strokeWidth={2} />
          </button>
          <button
            onClick={handleMinimize}
            className="flex h-8 w-[46px] items-center justify-center border-l border-white/10 transition hover:bg-cyan-400/20 hover:text-cyan-400"
            title="Minimize"
          >
            <Minus size={14} strokeWidth={3} />
          </button>
          <button
            onClick={handleMaximize}
            className="flex h-8 w-[46px] items-center justify-center border-l border-white/10 transition hover:bg-cyan-400/20 hover:text-cyan-400"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            <Square size={14} strokeWidth={3} />
          </button>
          <button
            onClick={handleClose}
            className="flex h-8 w-[46px] items-center justify-center border-l border-white/10 transition hover:bg-red-500/20 hover:text-red-500"
            title="Close"
          >
            <X size={14} strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
}
