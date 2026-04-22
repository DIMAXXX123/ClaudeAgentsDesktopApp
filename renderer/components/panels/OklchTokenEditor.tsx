"use client";

/**
 * OklchTokenEditor
 *
 * A live theme token editor that lets users tweak --ut-* CSS custom properties
 * in real-time using OKLCH sliders. Changes are injected directly into
 * document.documentElement.style (inline overrides) — zero page reload needed.
 *
 * Features:
 *  - Lightness / Chroma / Hue sliders for each colour token
 *  - Live swatch preview next to each token row
 *  - "Reset token" (removes inline override, restores theme value)
 *  - "Reset all" button
 *  - CSS export snippet (copy-to-clipboard)
 *  - Works inside any PanelFrame
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type EditableToken,
  type OklchComponents,
  buildEditableTokens,
  cssColorToOklch,
  exportOverridesAsCss,
  formatOklch,
  resetCssVar,
  setOklchVar,
} from "@/lib/theme/oklchUtils";

// ─── Swatch component ─────────────────────────────────────────────────────────

function ColorSwatch({ oklch, size = 20 }: { oklch: OklchComponents; size?: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        borderRadius: 3,
        backgroundColor: formatOklch(oklch),
        border: "1px solid rgba(255,255,255,0.15)",
        flexShrink: 0,
      }}
      title={formatOklch(oklch)}
    />
  );
}

// ─── Slider row ───────────────────────────────────────────────────────────────

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  gradient?: string;
}

function SliderRow({ label, value, min, max, step, onChange, gradient }: SliderRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="text-[9px] font-mono tracking-widest uppercase opacity-50 shrink-0"
        style={{ width: 12 }}
      >
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1.5 appearance-none rounded-full cursor-pointer"
        style={{
          background: gradient ??
            `linear-gradient(to right, var(--ut-bg-grid), var(--ut-accent))`,
          accentColor: "var(--ut-accent)",
        }}
      />
      <span className="text-[9px] font-mono opacity-60 shrink-0 tabular-nums" style={{ width: 38, textAlign: "right" }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

// ─── Token row ────────────────────────────────────────────────────────────────

interface TokenRowProps {
  token: EditableToken;
  isEdited: boolean;
  onUpdate: (cssVar: string, oklch: OklchComponents) => void;
  onReset: (cssVar: string) => void;
}

function TokenRow({ token, isEdited, onUpdate, onReset }: TokenRowProps) {
  const [expanded, setExpanded] = useState(false);
  const { l, c, h } = token.oklch;

  const update = useCallback(
    (patch: Partial<OklchComponents>) =>
      onUpdate(token.cssVar, { l, c, h, ...patch }),
    [l, c, h, token.cssVar, onUpdate],
  );

  // Gradient for hue slider: full spectrum at token's L & C
  const hueGrad = `linear-gradient(to right,
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 0),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 60),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 120),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 180),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 240),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 300),
    oklch(${l.toFixed(3)} ${c.toFixed(3)} 360)
  )`;

  const lightnessGrad = `linear-gradient(to right,
    oklch(0 ${c.toFixed(3)} ${h.toFixed(1)}),
    oklch(0.5 ${c.toFixed(3)} ${h.toFixed(1)}),
    oklch(1 ${c.toFixed(3)} ${h.toFixed(1)})
  )`;

  const chromaGrad = `linear-gradient(to right,
    oklch(${l.toFixed(3)} 0 ${h.toFixed(1)}),
    oklch(${l.toFixed(3)} 0.4 ${h.toFixed(1)})
  )`;

  return (
    <div
      className={[
        "rounded border px-2 py-1.5 transition-colors",
        isEdited
          ? "border-[var(--ut-accent)] bg-[var(--ut-accent)]/5"
          : "border-[var(--ut-border)] bg-[var(--ut-bg-panel)]",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => setExpanded((x) => !x)}>
        <ColorSwatch oklch={token.oklch} />
        <span className="flex-1 text-[10px] font-mono tracking-wide text-[var(--ut-text-muted)]">
          {token.label}
        </span>
        {isEdited && (
          <button
            onClick={(e) => { e.stopPropagation(); onReset(token.cssVar); }}
            className="text-[9px] opacity-50 hover:opacity-100 transition-opacity px-1 font-mono"
            title="Reset to theme default"
          >
            ↺
          </button>
        )}
        <span className="text-[9px] opacity-30">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Sliders (expanded) */}
      {expanded && (
        <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-[var(--ut-border)]">
          <SliderRow
            label="L"
            value={l}
            min={0}
            max={1}
            step={0.001}
            gradient={lightnessGrad}
            onChange={(v) => update({ l: v })}
          />
          <SliderRow
            label="C"
            value={c}
            min={0}
            max={0.4}
            step={0.001}
            gradient={chromaGrad}
            onChange={(v) => update({ c: v })}
          />
          <SliderRow
            label="H"
            value={h}
            min={0}
            max={360}
            step={0.5}
            gradient={hueGrad}
            onChange={(v) => update({ h: v })}
          />
          <div className="text-[9px] font-mono opacity-30 truncate pt-0.5">
            {token.cssVar}: {formatOklch(token.oklch)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function OklchTokenEditor() {
  const [tokens, setTokens] = useState<EditableToken[]>([]);
  const [editedVars, setEditedVars] = useState<Set<string>>(new Set());
  const [copyLabel, setCopyLabel] = useState("Copy CSS");
  const hydratedRef = useRef(false);

  // Hydrate from live CSS vars on client mount
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    setTokens(buildEditableTokens());
  }, []);

  const handleUpdate = useCallback(
    (cssVar: string, oklch: OklchComponents) => {
      // 1. Inject live CSS variable
      setOklchVar(cssVar, oklch);

      // 2. Update local state
      setTokens((prev) =>
        prev.map((t) => (t.cssVar === cssVar ? { ...t, oklch } : t)),
      );
      setEditedVars((prev) => new Set([...prev, cssVar]));
    },
    [],
  );

  const handleReset = useCallback((cssVar: string) => {
    // Remove inline override → browser reverts to theme stylesheet value
    resetCssVar(cssVar);

    // Rebuild this token from the now-restored computed value
    setTokens((prev) =>
      prev.map((t) => {
        if (t.cssVar !== cssVar) return t;
        // Re-read the restored value from computed style
        const restored = getComputedStyle(document.documentElement)
          .getPropertyValue(cssVar)
          .trim();
        return { ...t, oklch: cssColorToOklch(restored), originalValue: restored };
      }),
    );
    setEditedVars((prev) => {
      const next = new Set(prev);
      next.delete(cssVar);
      return next;
    });
  }, []);

  const handleResetAll = useCallback(() => {
    tokens.forEach((t) => resetCssVar(t.cssVar));
    setTokens(buildEditableTokens());
    setEditedVars(new Set());
  }, [tokens]);

  const handleCopyCss = useCallback(async () => {
    const css = exportOverridesAsCss(tokens);
    try {
      await navigator.clipboard.writeText(css);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy CSS"), 1800);
    } catch {
      // Fallback: show in console
      // eslint-disable-next-line no-console
      console.log("[OKLCH Token Editor] CSS export:\n", css);
      setCopyLabel("See console");
      setTimeout(() => setCopyLabel("Copy CSS"), 2500);
    }
  }, [tokens]);

  if (tokens.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 opacity-40 text-xs font-mono">
        Loading tokens…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-[var(--ut-border)]">
        <span className="text-[10px] font-mono tracking-widest uppercase opacity-50 flex-1">
          🎨 OKLCH Tokens
        </span>
        {editedVars.size > 0 && (
          <span className="text-[9px] font-mono text-[var(--ut-accent)] opacity-70">
            {editedVars.size} edited
          </span>
        )}
      </div>

      {/* Token rows */}
      <div className="flex flex-col gap-1">
        {tokens.map((token) => (
          <TokenRow
            key={token.cssVar}
            token={token}
            isEdited={editedVars.has(token.cssVar)}
            onUpdate={handleUpdate}
            onReset={handleReset}
          />
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 pt-1 border-t border-[var(--ut-border)]">
        <button
          onClick={handleCopyCss}
          className={[
            "flex-1 text-[10px] font-mono py-1.5 rounded border transition-colors",
            "border-[var(--ut-border)] bg-[var(--ut-bg-panel2)]",
            "text-[var(--ut-text-muted)] hover:text-[var(--ut-text)]",
            "hover:border-[var(--ut-accent)]",
          ].join(" ")}
        >
          {copyLabel}
        </button>
        {editedVars.size > 0 && (
          <button
            onClick={handleResetAll}
            className={[
              "text-[10px] font-mono px-3 py-1.5 rounded border transition-colors",
              "border-[var(--ut-border)] bg-[var(--ut-bg-panel2)]",
              "text-[var(--ut-text-muted)] hover:text-red-400",
              "hover:border-red-400/50",
            ].join(" ")}
            title="Reset all token overrides"
          >
            Reset all
          </button>
        )}
      </div>
    </div>
  );
}
