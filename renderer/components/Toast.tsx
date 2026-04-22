"use client";

import { useEffect, useState } from "react";
import { toastListeners, type Toast, pushToast as pushToastImpl } from "@/lib/toastBus";

export const pushToast = pushToastImpl;

export function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const onToast = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3500);
    };
    toastListeners.add(onToast);
    return () => {
      toastListeners.delete(onToast);
    };
  }, []);

  return (
    <div className="pointer-events-none fixed bottom-24 right-4 z-[70] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto animate-slide-up rounded-sm border px-3 py-2 text-[11px] font-mono backdrop-blur-sm ${
            t.tone === "error"
              ? "border-neon-red/70 bg-neon-red/10 text-neon-red shadow-neon-red"
              : t.tone === "success"
                ? "border-neon-green/70 bg-neon-green/10 text-neon-green shadow-neon-green"
                : "border-neon-cyan/70 bg-neon-cyan/10 text-neon-cyan shadow-neon-cyan"
          }`}
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}
