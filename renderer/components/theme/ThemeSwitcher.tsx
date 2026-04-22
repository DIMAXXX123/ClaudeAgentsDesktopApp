"use client";

import { useTheme } from "@/lib/theme/themeStore";
import { THEMES, type ThemeId } from "@/lib/theme/themes";
import { useState } from "react";

interface ThemeSwitcherProps {
  /** Compact: show only icons in a row. Expanded: show label cards. */
  variant?: "compact" | "expanded";
  className?: string;
}

export function ThemeSwitcher({ variant = "compact", className = "" }: ThemeSwitcherProps) {
  const { theme, setTheme } = useTheme();
  const [hovered, setHovered] = useState<ThemeId | null>(null);

  if (variant === "expanded") {
    return (
      <div className={`flex flex-col gap-1.5 ${className}`}>
        <p className="text-[10px] tracking-widest uppercase opacity-50 px-1">Theme</p>
        {(Object.values(THEMES) as (typeof THEMES)[ThemeId][]).map((t) => {
          const isActive = theme === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              onMouseEnter={() => setHovered(t.id)}
              onMouseLeave={() => setHovered(null)}
              className={[
                "flex items-center gap-2 px-3 py-2 rounded text-xs transition-all",
                "border text-left w-full",
                isActive
                  ? "border-[var(--ut-accent)] bg-[var(--ut-accent)]/10 text-[var(--ut-accent)]"
                  : hovered === t.id
                  ? "border-[var(--ut-border)] bg-[var(--ut-bg-panel2)] text-[var(--ut-text)]"
                  : "border-transparent bg-[var(--ut-bg-panel)] text-[var(--ut-text-muted)]",
              ].join(" ")}
              title={t.label}
            >
              <span className="text-sm">{t.icon}</span>
              <span className="font-mono tracking-wide">{t.label}</span>
              {isActive && (
                <span className="ml-auto text-[9px] tracking-widest opacity-70">ACTIVE</span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Compact variant — icon pills row
  return (
    <div
      className={`flex items-center gap-1 ${className}`}
      title="Switch theme"
      role="group"
      aria-label="Theme switcher"
    >
      {(Object.values(THEMES) as (typeof THEMES)[ThemeId][]).map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            onMouseEnter={() => setHovered(t.id)}
            onMouseLeave={() => setHovered(null)}
            className={[
              "w-7 h-7 rounded text-sm flex items-center justify-center transition-all duration-150",
              "border",
              isActive
                ? "border-[var(--ut-accent)] bg-[var(--ut-accent)]/15 scale-110"
                : hovered === t.id
                ? "border-[var(--ut-border)] bg-[var(--ut-bg-panel2)]"
                : "border-transparent bg-[var(--ut-bg-panel)] opacity-60",
            ].join(" ")}
            aria-pressed={isActive}
            aria-label={`${t.label} theme`}
            title={t.label}
          >
            {t.icon}
          </button>
        );
      })}
    </div>
  );
}
