/**
 * WebhookInbox — real-time panel showing incoming webhook events.
 *
 * Features:
 *  • Auto-polls every 3 s — new events appear without refresh
 *  • Source badge (GitHub / Stripe / Vercel / …)
 *  • Click to expand full headers + body (JSON pretty-printed)
 *  • Clear-all button
 *  • Endpoint copy helper
 */
"use client";

import { useState } from "react";
import clsx from "clsx";
import { useWebhookInbox } from "@/lib/integrations/useWebhookInbox";
import { SOURCE_COLORS } from "@/lib/integrations/webhookInbox";
import type { WebhookEvent, WebhookSource } from "@/lib/integrations/webhookInbox";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ms: number): string {
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function bytesFmt(n: number): string {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SourceBadge({ source }: { source: WebhookSource }) {
  const cls = SOURCE_COLORS[source] ?? "bg-zinc-600 text-white";
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
        cls
      )}
    >
      {source}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handle}
      className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function EventRow({ ev }: { ev: WebhookEvent }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-lg border border-zinc-800 bg-zinc-900 transition-colors",
        open && "border-zinc-600"
      )}
    >
      {/* Header row */}
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <SourceBadge source={ev.source} />
        <span className="flex-1 truncate text-sm font-mono text-zinc-200">
          {ev.eventType}
        </span>
        <span className="text-[10px] text-zinc-500">{bytesFmt(ev.rawSize)}</span>
        <span className="min-w-[60px] text-right text-[10px] text-zinc-500">
          {relativeTime(ev.receivedAt)}
        </span>
        <ChevronIcon open={open} />
      </button>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2 space-y-2">
          {/* ID + method */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="font-mono">{ev.id}</span>
            <span className="rounded bg-zinc-800 px-1">{ev.method}</span>
            {ev.verified === true && (
              <span className="text-green-400">✓ verified</span>
            )}
            {ev.verified === false && (
              <span className="text-red-400">✗ unverified</span>
            )}
          </div>

          {/* Headers */}
          <details className="group">
            <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200 select-none">
              Headers ({Object.keys(ev.headers).length})
            </summary>
            <pre className="mt-1 max-h-36 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-300 font-mono">
              {JSON.stringify(ev.headers, null, 2)}
            </pre>
          </details>

          {/* Body */}
          <div className="space-y-1">
            <span className="text-xs text-zinc-400">Body</span>
            <pre className="max-h-48 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-300 font-mono">
              {typeof ev.body === "string"
                ? ev.body
                : JSON.stringify(ev.body, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={clsx(
        "h-3 w-3 shrink-0 text-zinc-500 transition-transform",
        open && "rotate-180"
      )}
      viewBox="0 0 16 16"
      fill="currentColor"
    >
      <path d="M4.427 6.427a.75.75 0 0 1 1.06 0L8 8.94l2.513-2.513a.75.75 0 0 1 1.06 1.06l-3.043 3.044a.75.75 0 0 1-1.06 0L4.427 7.487a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface WebhookInboxProps {
  /** Override polling interval (ms). */
  intervalMs?: number;
  className?: string;
}

export function WebhookInbox({ intervalMs, className }: WebhookInboxProps) {
  const inbox = useWebhookInbox({ intervalMs });

  // Derive endpoint URL (works both server and client side)
  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/integrations/webhook-inbox`
      : "/api/integrations/webhook-inbox";

  const events = inbox.status === "ok" ? inbox.events : [];
  const count = inbox.status === "ok" ? inbox.count : 0;

  return (
    <div
      className={clsx(
        "flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4",
        className
      )}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            Webhook Inbox
          </span>
          {inbox.status === "ok" && (
            <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
              {count}
            </span>
          )}
          {inbox.status === "loading" && (
            <Spinner />
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={inbox.refresh}
            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            Refresh
          </button>
          <button
            onClick={() => void inbox.clear()}
            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Endpoint */}
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-2 py-1.5">
        <span className="flex-1 truncate font-mono text-[11px] text-zinc-400">
          {endpoint}
        </span>
        <CopyButton text={endpoint} />
      </div>

      {/* Error state */}
      {inbox.status === "error" && (
        <p className="text-xs text-red-400">{inbox.message}</p>
      )}

      {/* Events list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[420px]">
        {events.length === 0 ? (
          <EmptyState />
        ) : (
          events.map((ev) => <EventRow key={ev.id} ev={ev} />)
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
      <InboxIcon />
      <p className="text-sm">No events yet</p>
      <p className="text-[11px]">
        POST a JSON payload to the endpoint above
      </p>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3 w-3 animate-spin text-zinc-500"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

function InboxIcon() {
  return (
    <svg
      className="h-8 w-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859M12 3v8.25m0 0-3-3m3 3 3-3M2.25 19.5h19.5a2.25 2.25 0 002.25-2.25V6.75a2.25 2.25 0 00-2.25-2.25H2.25A2.25 2.25 0 000 6.75v10.5a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}
