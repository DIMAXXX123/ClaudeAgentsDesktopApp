'use client';

import React, { useState, useRef, useEffect } from 'react';
import { rankCommands } from '@/lib/fuzzy';
import { getBuiltInCommands, LauncherCommand } from '@/lib/commands';

export default function LauncherPage() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [commands, setCommands] = useState<LauncherCommand[]>(getBuiltInCommands());
  const [filtered, setFiltered] = useState<LauncherCommand[]>(getBuiltInCommands());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus input on load
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setFiltered(commands);
      setSelectedIndex(0);
    } else {
      const ranked = rankCommands(commands, query);
      setFiltered(ranked);
      setSelectedIndex(0);
    }
  }, [query, commands]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      window.ultronos?.launcher.hide();
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filtered.length);
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filtered[selectedIndex];
      if (selected) {
        executeCommand(selected);
      }
    }
  };

  const executeCommand = async (cmd: LauncherCommand) => {
    try {
      await cmd.execute();
      setQuery('');
      await window.ultronos?.launcher.hide();
    } catch (error) {
      console.error('[launcher] Command execution failed:', error);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none">
      <div className="pointer-events-auto w-[720px] rounded-lg backdrop-blur-md border border-cyan-500/30 shadow-2xl"
        style={{
          backgroundColor: 'rgba(12, 12, 16, 0.9)',
          boxShadow: '0 0 30px rgba(0, 255, 255, 0.2)',
        }}>

        {/* Header */}
        <div className="border-b border-cyan-500/20 px-6 py-4">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search commands (type to filter)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="w-full bg-transparent text-cyan-400 placeholder-cyan-700 outline-none font-mono text-sm"
            style={{
              textShadow: '0 0 10px rgba(0, 255, 255, 0.5)',
            }}
          />
        </div>

        {/* Commands list */}
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-8 text-center text-cyan-600 font-mono text-xs">
              No commands found
            </div>
          ) : (
            filtered.map((cmd, idx) => (
              <CommandItem
                key={cmd.id}
                cmd={cmd}
                selected={idx === selectedIndex}
                onSelect={() => {
                  setSelectedIndex(idx);
                  executeCommand(cmd);
                }}
              />
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="border-t border-cyan-500/20 px-6 py-2 text-xs text-cyan-700 font-mono flex justify-between">
          <span>↑↓ Navigate • Enter Execute • Esc Quit</span>
          <span>{filtered.length} results</span>
        </div>
      </div>
    </div>
  );
}

function CommandItem({
  cmd,
  selected,
  onSelect,
}: {
  cmd: LauncherCommand;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`px-6 py-3 cursor-pointer border-l-2 transition-colors ${
        selected
          ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
          : 'border-transparent text-cyan-500 hover:bg-cyan-500/5'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{cmd.icon || '⚡'}</span>
        <div className="flex-1 min-w-0">
          <div className="font-mono text-sm font-semibold truncate">{cmd.title}</div>
          {cmd.subtitle && (
            <div className="text-xs text-cyan-700 truncate mt-0.5">{cmd.subtitle}</div>
          )}
        </div>
      </div>
    </div>
  );
}
