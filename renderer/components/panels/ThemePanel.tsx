"use client";

import { useState } from "react";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import { OklchTokenEditor } from "@/components/panels/OklchTokenEditor";
import { useTheme } from "@/lib/theme/themeStore";
import { THEMES } from "@/lib/theme/themes";

type Tab = "themes" | "tokens";

export function ThemePanel() {
  const { theme } = useTheme();
  const t = THEMES[theme];
  const [tab, setTab] = useState<Tab>("themes");

  return (
    <div
      className="neon-frame rounded-lg p-3 flex flex-col gap-3 select-none"
      style={{ minWidth: 200 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--ut-border)] pb-2">
        <span className="text-xs tracking-widest uppercase opacity-50 font-mono">
          🎨 Theme
        </span>
        <span className="ml-auto text-[10px] opacity-40 font-mono">{t.label}</span>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1">
        {(["themes", "tokens"] as Tab[]).map((id) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={[
              "flex-1 text-[9px] font-mono tracking-widest uppercase py-1 rounded border transition-colors",
              tab === id
                ? "border-[var(--ut-accent)] bg-[var(--ut-accent)]/10 text-[var(--ut-accent)]"
                : "border-[var(--ut-border)] text-[var(--ut-text-muted)] hover:border-[var(--ut-border)]",
            ].join(" ")}
          >
            {id === "themes" ? "🌑 Themes" : "🎛 Tokens"}
          </button>
        ))}
      </div>

      {/* Themes tab */}
      {tab === "themes" && (
        <>
          <ThemeSwitcher variant="expanded" />

          {/* Token preview swatch row */}
          <div className="flex gap-1 mt-1">
            {(["bgBase", "bgPanel", "accent", "accentAlt"] as const).map((key) => (
              <div
                key={key}
                className="flex-1 h-4 rounded-sm border border-[var(--ut-border)] transition-colors duration-300"
                style={{ backgroundColor: t.tokens[key] }}
                title={`${key}: ${t.tokens[key]}`}
              />
            ))}
          </div>
        </>
      )}

      {/* OKLCH token editor tab */}
      {tab === "tokens" && <OklchTokenEditor />}
    </div>
  );
}
