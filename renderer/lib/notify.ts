"use client";

import { pushToast } from "@/lib/toastBus";

export type Tone = "info" | "success" | "error" | "warn";

let permissionRequested = false;

export function initNotifications() {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (permissionRequested) return;
  permissionRequested = true;
  if (Notification.permission === "default") {
    Notification.requestPermission().catch(() => {});
  }
}

function systemNotify(title: string, body: string, tone: Tone) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: body.slice(0, 240),
      icon: "/favicon.ico",
      tag: `ultronos-${tone}-${title}`,
      silent: tone === "info",
    });
    setTimeout(() => n.close(), tone === "error" ? 10_000 : 5_000);
  } catch {
    // Some browsers forbid Notification via constructor — ignore
  }
}

export function notify(title: string, body: string, tone: Tone = "info") {
  if (typeof window !== "undefined" && window.ultronos?.notify) {
    const urgency = tone === "error" ? "critical" : tone === "warn" ? "normal" : "low";
    window.ultronos.notify(title, body, urgency);
    return;
  }
  const toastTone: "info" | "success" | "error" = tone === "warn" ? "error" : tone;
  pushToast(`${title}${body ? ` — ${body.slice(0, 120)}` : ""}`, toastTone);
  if (typeof document !== "undefined" && document.hidden) {
    systemNotify(title, body, tone);
  }
}

export function notifyAlways(title: string, body: string, tone: Tone = "info") {
  const toastTone: "info" | "success" | "error" = tone === "warn" ? "error" : tone;
  pushToast(`${title}${body ? ` — ${body.slice(0, 120)}` : ""}`, toastTone);
  systemNotify(title, body, tone);
}
