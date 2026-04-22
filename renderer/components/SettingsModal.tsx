'use client';

import { useEffect, useState, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Palette,
  AppWindow,
  Bell,
  FolderOpen,
  Info,
  ExternalLink,
  RotateCcw,
  Power,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { UltronosSettings, UltronosAppInfo } from '@/types/ultronos';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type TabId = 'appearance' | 'window' | 'notifications' | 'data' | 'about';

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  { id: 'window', label: 'Window', icon: <AppWindow size={16} /> },
  { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  { id: 'data', label: 'Data & Paths', icon: <FolderOpen size={16} /> },
  { id: 'about', label: 'About', icon: <Info size={16} /> },
];

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('appearance');
  const [settings, setSettings] = useState<UltronosSettings | null>(null);
  const [appInfo, setAppInfo] = useState<UltronosAppInfo | null>(null);
  const [resettingConfirm, setResettingConfirm] = useState(false);
  const resetTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const isDesktop = typeof window !== 'undefined' && window.ultronos;

  // Load settings
  useEffect(() => {
    if (!open || !isDesktop) return;

    const load = async () => {
      try {
        const s = await window.ultronos!.settings.get();
        setSettings(s);
      } catch (err) {
        console.error('Failed to load settings:', err);
      }
    };
    load();
  }, [open, isDesktop]);

  // Load app info for About tab
  useEffect(() => {
    if (!open || !isDesktop) return;

    const load = async () => {
      try {
        const info = await window.ultronos!.app.info();
        setAppInfo(info);
      } catch (err) {
        console.error('Failed to load app info:', err);
      }
    };
    load();
  }, [open, isDesktop]);

  const handleSettingsChange = async (patch: Partial<UltronosSettings>) => {
    if (!isDesktop) return;

    // Update locally first (optimistic)
    setSettings((prev) => (prev ? { ...prev, ...patch } : null));

    // Sync with main process
    try {
      const updated = await window.ultronos!.settings.set(patch);
      setSettings(updated);
    } catch (err) {
      console.error('Failed to update settings:', err);
    }
  };

  const handleReset = async () => {
    if (!isDesktop) return;

    if (!resettingConfirm) {
      setResettingConfirm(true);
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => {
        setResettingConfirm(false);
      }, 3000);
      return;
    }

    try {
      const defaults = await window.ultronos!.settings.reset();
      setSettings(defaults);
      setResettingConfirm(false);
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  };

  const handleRelaunch = async () => {
    if (!isDesktop) return;
    try {
      await window.ultronos!.app.relaunch();
    } catch (err) {
      console.error('Failed to relaunch:', err);
    }
  };

  const handleOpenPath = async (target: 'userData' | 'logs' | 'temp') => {
    if (!isDesktop) return;
    try {
      await window.ultronos!.shell.openPath(target);
    } catch (err) {
      console.error(`Failed to open ${target}:`, err);
    }
  };

  const handleOpenExternal = async (url: string) => {
    if (!isDesktop) return;
    try {
      await window.ultronos!.shell.openExternal(url);
    } catch (err) {
      console.error('Failed to open external URL:', err);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <AnimatePresence>
          {open && (
            <Dialog.Content
              onOpenAutoFocus={(e) => e.preventDefault()}
              asChild
            >
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 flex w-[800px] max-w-[90vw] max-h-[85vh] flex-col overflow-hidden rounded-xl border border-cyan-400/20 bg-[#05070d]/95 backdrop-blur-xl shadow-[0_0_80px_rgba(34,211,238,0.15)]"
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                style={{ x: '-50%', y: '-50%' }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-cyan-400/20 px-6 py-4">
                  <h2 className="pixel text-cyan-400 text-sm tracking-widest [text-shadow:_0_0_8px_#06b6d4]">
                    ⚙ SETTINGS
                  </h2>
                  <button
                    onClick={() => onOpenChange(false)}
                    className="flex h-8 w-8 items-center justify-center rounded transition hover:bg-white/5 active:bg-white/10"
                    aria-label="Close settings"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                  {/* Sidebar */}
                  <div className="w-[180px] shrink-0 flex flex-col gap-1 border-r border-white/10 bg-black/30 p-3 overflow-y-auto">
                    {TABS.map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-sm text-sm font-mono transition text-left',
                          activeTab === tab.id
                            ? 'border-l-2 border-cyan-400 bg-cyan-400/10 text-cyan-100'
                            : 'border-l-2 border-transparent text-white/60 hover:text-white/80',
                        )}
                      >
                        <span className="shrink-0">{tab.icon}</span>
                        <span className="text-xs uppercase tracking-widest truncate">{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Content Pane */}
                  <div className="flex-1 min-w-0 overflow-y-auto px-6 py-4">
                    {!isDesktop ? (
                      <div className="flex items-center justify-center h-full text-center">
                        <div className="text-white/40 text-sm font-mono">
                          Desktop settings unavailable in browser
                        </div>
                      </div>
                    ) : settings ? (
                      <>
                        {/* Appearance Tab */}
                        {activeTab === 'appearance' && (
                          <div className="space-y-6">
                            <SettingGroup label="Zoom">
                              <div className="flex items-center gap-4">
                                <button
                                  onClick={() => window.ultronos!.zoom.out()}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-sm font-mono transition"
                                >
                                  −
                                </button>
                                <div className="flex-1 flex items-center gap-3">
                                  <input
                                    type="range"
                                    min="0.5"
                                    max="2.5"
                                    step="0.05"
                                    value={settings.zoomFactor}
                                    onChange={(e) =>
                                      handleSettingsChange({ zoomFactor: parseFloat(e.target.value) })
                                    }
                                    className="flex-1 h-1.5 bg-gradient-to-r from-cyan-900/30 to-cyan-400 rounded-full appearance-none cursor-pointer accent-cyan-400"
                                    style={{
                                      background: `linear-gradient(to right, rgb(22, 82, 144, 0.3), rgb(34, 211, 238))`,
                                    }}
                                  />
                                  <span className="w-12 text-right text-sm font-mono text-cyan-400">
                                    {Math.round(settings.zoomFactor * 100)}%
                                  </span>
                                </div>
                                <button
                                  onClick={() => window.ultronos!.zoom.in()}
                                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-sm font-mono transition"
                                >
                                  +
                                </button>
                              </div>
                            </SettingGroup>

                            <SettingGroup label="Theme">
                              <select
                                value={settings.theme}
                                onChange={(e) =>
                                  handleSettingsChange({ theme: e.target.value as any })
                                }
                                className="w-full px-3 py-2 bg-black/50 border border-white/10 focus:border-cyan-400 rounded-md text-sm font-mono text-white focus:outline-none transition"
                              >
                                <option value="cyberpunk">Cyberpunk</option>
                                <option value="dark">Dark</option>
                                <option value="midnight">Midnight</option>
                              </select>
                            </SettingGroup>

                            <SettingGroup label="Scanlines">
                              <select
                                value={settings.scanlinesIntensity}
                                onChange={(e) =>
                                  handleSettingsChange({ scanlinesIntensity: e.target.value as any })
                                }
                                className="w-full px-3 py-2 bg-black/50 border border-white/10 focus:border-cyan-400 rounded-md text-sm font-mono text-white focus:outline-none transition"
                              >
                                <option value="off">Off</option>
                                <option value="subtle">Subtle</option>
                                <option value="normal">Normal</option>
                                <option value="heavy">Heavy</option>
                              </select>
                            </SettingGroup>

                            <SettingGroup label="Reduce Motion">
                              <CustomToggle
                                checked={settings.reduceMotion}
                                onChange={(value) =>
                                  handleSettingsChange({ reduceMotion: value })
                                }
                              />
                            </SettingGroup>
                          </div>
                        )}

                        {/* Window Tab */}
                        {activeTab === 'window' && (
                          <div className="space-y-6">
                            <SettingGroup label="Always on Top">
                              <CustomToggle
                                checked={settings.alwaysOnTop}
                                onChange={(value) =>
                                  handleSettingsChange({ alwaysOnTop: value })
                                }
                              />
                            </SettingGroup>

                            <SettingGroup label="Start Minimized">
                              <CustomToggle
                                checked={settings.startMinimized}
                                onChange={(value) =>
                                  handleSettingsChange({ startMinimized: value })
                                }
                              />
                            </SettingGroup>

                            <SettingGroup label="Hide to Tray on Close">
                              <CustomToggle
                                checked={settings.hideToTrayOnClose}
                                onChange={(value) =>
                                  handleSettingsChange({ hideToTrayOnClose: value })
                                }
                              />
                            </SettingGroup>

                            <SettingGroup label="Launch on Startup">
                              <CustomToggle
                                checked={settings.launchOnStartup}
                                onChange={(value) =>
                                  handleSettingsChange({ launchOnStartup: value })
                                }
                              />
                            </SettingGroup>
                          </div>
                        )}

                        {/* Notifications Tab */}
                        {activeTab === 'notifications' && (
                          <div className="space-y-6">
                            <SettingGroup label="Desktop Notifications">
                              <CustomToggle
                                checked={settings.desktopNotifications}
                                onChange={(value) =>
                                  handleSettingsChange({ desktopNotifications: value })
                                }
                              />
                            </SettingGroup>

                            <SettingGroup label="Sound Effects">
                              <CustomToggle
                                checked={settings.soundEffects}
                                onChange={(value) =>
                                  handleSettingsChange({ soundEffects: value })
                                }
                              />
                            </SettingGroup>
                          </div>
                        )}

                        {/* Data & Paths Tab */}
                        {activeTab === 'data' && (
                          <div className="space-y-6">
                            <SettingGroup label="User Data">
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  readOnly
                                  value={appInfo?.userData || 'Loading...'}
                                  className="flex-1 px-3 py-2 bg-black/50 border border-white/10 rounded-md text-xs font-mono text-white/70 focus:outline-none"
                                />
                                <button
                                  onClick={() => handleOpenPath('userData')}
                                  className="px-3 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-xs font-mono transition whitespace-nowrap"
                                >
                                  Open
                                </button>
                              </div>
                            </SettingGroup>

                            <SettingGroup label="Logs">
                              <button
                                onClick={() => handleOpenPath('logs')}
                                className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-sm font-mono transition"
                              >
                                Open Logs Folder
                              </button>
                            </SettingGroup>

                            <SettingGroup label="Temporary">
                              <button
                                onClick={() => handleOpenPath('temp')}
                                className="w-full px-3 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-sm font-mono transition"
                              >
                                Open Temp Folder
                              </button>
                            </SettingGroup>
                          </div>
                        )}

                        {/* About Tab */}
                        {activeTab === 'about' && appInfo && (
                          <div className="space-y-6">
                            <SettingGroup label="App Name">
                              <div className="text-sm font-mono text-white/70">{appInfo.name}</div>
                            </SettingGroup>

                            <SettingGroup label="Version">
                              <div className="text-sm font-mono text-white/70">{appInfo.version}</div>
                            </SettingGroup>

                            <SettingGroup label="Electron">
                              <div className="text-sm font-mono text-white/70">{appInfo.electronVersion}</div>
                            </SettingGroup>

                            <SettingGroup label="Node">
                              <div className="text-sm font-mono text-white/70">{appInfo.nodeVersion}</div>
                            </SettingGroup>

                            <SettingGroup label="Chrome">
                              <div className="text-sm font-mono text-white/70">{appInfo.chromeVersion}</div>
                            </SettingGroup>

                            <SettingGroup label="Platform">
                              <div className="text-sm font-mono text-white/70">
                                {appInfo.platform} ({appInfo.arch})
                              </div>
                            </SettingGroup>

                            <SettingGroup label="Repository">
                              <button
                                onClick={() =>
                                  handleOpenExternal('https://github.com/')
                                }
                                className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-sm font-mono transition"
                              >
                                <ExternalLink size={14} />
                                GitHub
                              </button>
                            </SettingGroup>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center justify-center h-full text-white/40 font-mono text-sm">
                        Loading settings…
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-white/10 bg-black/30 px-6 py-3 gap-3">
                  <button
                    onClick={handleReset}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs font-mono transition',
                      resettingConfirm
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'hover:bg-white/10 active:bg-white/15',
                    )}
                  >
                    <RotateCcw size={12} />
                    {resettingConfirm ? 'Click again to confirm' : 'Reset to Defaults'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRelaunch}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-xs font-mono transition"
                    >
                      <Power size={12} />
                      Relaunch
                    </button>
                    <button
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/10 rounded-md text-xs font-mono transition"
                    >
                      <Check size={12} />
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            </Dialog.Content>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-mono uppercase tracking-widest text-white/70">{label}</label>
      <div>{children}</div>
    </div>
  );
}

function CustomToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <motion.button
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-5 w-9 rounded-full border transition-colors',
        checked
          ? 'bg-cyan-400/20 border-cyan-400'
          : 'bg-white/5 border-white/10'
      )}
      layout
    >
      <motion.div
        className="absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-cyan-400"
        animate={{ x: checked ? 18 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </motion.button>
  );
}
