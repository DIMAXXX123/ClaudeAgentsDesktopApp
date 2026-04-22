"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";

interface Sizes {
  left: number;
  galaxy: number;
  right: number;
}

const DEFAULTS: Sizes = { left: 240, galaxy: 340, right: 300 };
const MIN: Sizes = { left: 160, galaxy: 220, right: 220 };
const MAX: Sizes = { left: 400, galaxy: 560, right: 480 };
const STORAGE_KEY = "ultronos.layout.v2";

interface ResizableLayoutProps {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  galaxy: ReactNode;
  galaxyOpen: boolean;
}

export function ResizableLayout({ left, center, right, galaxy, galaxyOpen }: ResizableLayoutProps) {
  const [sizes, setSizes] = useState<Sizes>(DEFAULTS);
  const draggingRef = useRef<{ which: keyof Sizes; startX: number; startVal: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setSizes({
          left: clamp(parsed.left ?? DEFAULTS.left, MIN.left, MAX.left),
          galaxy: clamp(parsed.galaxy ?? DEFAULTS.galaxy, MIN.galaxy, MAX.galaxy),
          right: clamp(parsed.right ?? DEFAULTS.right, MIN.right, MAX.right),
        });
      }
    } catch {}
  }, []);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const d = draggingRef.current;
      if (!d) return;
      const delta = e.clientX - d.startX;
      const sign = d.which === "right" ? -1 : 1;
      const next = clamp(d.startVal + delta * sign, MIN[d.which], MAX[d.which]);
      setSizes((s) => ({ ...s, [d.which]: next }));
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(sizes));
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [sizes]);

  const startDrag = useCallback(
    (which: keyof Sizes) => (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = { which, startX: e.clientX, startVal: sizes[which] };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [sizes],
  );

  return (
    <div className="flex h-full w-full min-w-0">
      <div style={{ width: sizes.left }} className="h-full shrink-0 overflow-hidden">
        {left}
      </div>
      <Divider onMouseDown={startDrag("left")} />
      <div className="h-full min-w-0 flex-1 overflow-hidden">{center}</div>
      {galaxyOpen && (
        <>
          <Divider onMouseDown={startDrag("galaxy")} />
          <div style={{ width: sizes.galaxy }} className="h-full shrink-0 overflow-hidden">
            {galaxy}
          </div>
        </>
      )}
      <Divider onMouseDown={startDrag("right")} />
      <div style={{ width: sizes.right }} className="h-full shrink-0 overflow-hidden">
        {right}
      </div>
    </div>
  );
}

function Divider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="group relative w-[3px] shrink-0 cursor-col-resize bg-white/5 transition hover:bg-cyan-400/50"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
