/**
 * WebhookInboxSSE — live webhook event log powered by SSE.
 *
 * Key upgrades over the polling WebhookInbox:
 *  • Real-time push (no 3 s lag) — events appear the instant they land
 *  • shadcn-style Accordion for each event row with animated expand/collapse
 *  • Collapsible JSON payload inspector with syntax-aware formatting
 *  • SSE connection status badge (connecting / live / error)
 *  • "New" flash animation on freshly received events
 *  • Filter controls panel (source badges, event-type search, verified toggle,
 *    min-size selector) — collapsible, shows active-filter indicator
 */
"use client";

import { useState, useCallback, useReducer } from "react";
import clsx from "clsx";
import { useWebhookInboxSSE, SSEConnectionStatus } from "@/lib/integrations/useWebhookInboxSSE";
import { SOURCE_COLORS } from "@/lib/integrations/webhookInbox";
import type { WebhookEvent, WebhookSource } from "@/lib/integrations/webhookInbox";
import {
  applyFilters,
  countBySource,
  createDefaultFilter,
  isFilterActive,
  resetFilter,
  setEventTypeQuery,
  setMinSizeBytes,
  setVerifiedOnly,
  toggleSource,
} from "@/lib/integrations/webhookInboxFilters";
import type { WebhookFilterState } from "@/lib/integrations/webhookInboxFilters";

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

function jsonPretty(value: unknown): string {
  if (typeof value === "string") {
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }
  return JSON.stringify(value, null, 2);
}

// All webhook sources, in display order
const ALL_SOURCES: WebhookSource[] = [
  "github",
  "stripe",
  "vercel",
  "telegram",
  "supabase",
  "generic",
];

// Min-size options
const SIZE_OPTIONS: { label: string; bytes: number }[] = [
  { label: "Any size", bytes: 0 },
  { label: "> 256 B", bytes: 256 },
  { label: "> 1 KB",  bytes: 1024 },
  { label: "> 10 KB", bytes: 10_240 },
];

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

function StatusBadge({ status }: { status: SSEConnectionStatus }) {
  const map: Record<SSEConnectionStatus, { dot: string; label: string }> = {
    connecting: { dot: "bg-yellow-400 animate-pulse", label: "Connecting…" },
    open: { dot: "bg-green-400", label: "Live" },
    closed: { dot: "bg-zinc-500", label: "Closed" },
    error: { dot: "bg-red-500 animate-pulse", label: "Error" },
    unsupported: { dot: "bg-zinc-600", label: "No SSE" },
  };
  const { dot, label } = map[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx("h-1.5 w-1.5 rounded-full", dot)} />
      <span className="text-[10px] text-zinc-400">{label}</span>
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handle = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    });
  }, [text]);
  return (
    <button
      onClick={handle}
      className="rounded bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300 hover:bg-zinc-600 transition-colors"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Accordion section — animated collapsible with max-height trick
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function AccordionSection({ title, defaultOpen = false, children }: AccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded border border-zinc-800">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs text-zinc-400 hover:text-zinc-200 transition-colors select-none"
      >
        <span>{title}</span>
        <svg
          className={clsx(
            "h-3 w-3 shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 6.427a.75.75 0 0 1 1.06 0L8 8.94l2.513-2.513a.75.75 0 0 1 1.06 1.06l-3.043 3.044a.75.75 0 0 1-1.06 0L4.427 7.487a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>
      <div
        className={clsx(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-zinc-800 p-2">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter controls panel
// ---------------------------------------------------------------------------

interface FilterControlsProps {
  filter: WebhookFilterState;
  allEvents: WebhookEvent[];
  onToggleSource: (s: WebhookSource) => void;
  onEventTypeQuery: (q: string) => void;
  onVerifiedOnly: (v: boolean | null) => void;
  onMinSize: (bytes: number) => void;
  onReset: () => void;
}

function FilterControls({
  filter,
  allEvents,
  onToggleSource,
  onEventTypeQuery,
  onVerifiedOnly,
  onMinSize,
  onReset,
}: FilterControlsProps) {
  const counts = countBySource(allEvents);

  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/60 p-3 space-y-3">
      {/* Source badges */}
      <div>
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Source
        </p>
        <div className="flex flex-wrap gap-1.5">
          {ALL_SOURCES.map((src) => {
            const active = filter.sources.has(src);
            const count = counts[src];
            const colorClass = SOURCE_COLORS[src] ?? "bg-zinc-600 text-white";
            return (
              <button
                key={src}
                type="button"
                onClick={() => onToggleSource(src)}
                className={clsx(
                  "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all duration-150",
                  active
                    ? clsx(colorClass, "ring-2 ring-white/30 scale-[1.05]")
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                )}
              >
                {src}
                {count > 0 && (
                  <span
                    className={clsx(
                      "rounded-full px-1 font-mono text-[9px]",
                      active ? "bg-white/20" : "bg-zinc-700 text-zinc-400"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Event type search + size select row */}
      <div className="flex flex-wrap gap-2">
        {/* Event type search */}
        <div className="flex min-w-[140px] flex-1 items-center gap-1.5 rounded border border-zinc-700 bg-zinc-950 px-2 py-1">
          <svg
            className="h-3 w-3 shrink-0 text-zinc-500"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M6.5 0a6.5 6.5 0 1 0 4.28 11.27l3.73 3.73a.75.75 0 1 0 1.06-1.06l-3.73-3.73A6.5 6.5 0 0 0 6.5 0Zm-5 6.5a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" />
          </svg>
          <input
            type="text"
            placeholder="event type…"
            value={filter.eventTypeQuery}
            onChange={(e) => onEventTypeQuery(e.target.value)}
            className="w-full bg-transparent text-[11px] text-zinc-200 placeholder:text-zinc-600 outline-none"
          />
          {filter.eventTypeQuery && (
            <button
              type="button"
              onClick={() => onEventTypeQuery("")}
              className="text-zinc-600 hover:text-zinc-300 transition-colors"
            >
              ×
            </button>
          )}
        </div>

        {/* Min size select */}
        <select
          value={filter.minSizeBytes}
          onChange={(e) => onMinSize(Number(e.target.value))}
          className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-300 outline-none hover:border-zinc-600 transition-colors"
        >
          {SIZE_OPTIONS.map((o) => (
            <option key={o.bytes} value={o.bytes}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Verified toggle */}
      <div className="flex items-center gap-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          Verified
        </p>
        {(
          [
            { label: "All", value: null },
            { label: "✓ Verified", value: true },
            { label: "✗ Unverified", value: false },
          ] as { label: string; value: boolean | null }[]
        ).map(({ label, value }) => (
          <button
            key={String(value)}
            type="button"
            onClick={() => onVerifiedOnly(value)}
            className={clsx(
              "rounded px-2 py-0.5 text-[10px] transition-colors",
              filter.verifiedOnly === value
                ? "bg-zinc-600 text-zinc-100"
                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
            )}
          >
            {label}
          </button>
        ))}

        {/* Reset — only when something is active */}
        {isFilterActive(filter) && (
          <button
            type="button"
            onClick={onReset}
            className="ml-auto rounded px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 transition-colors"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Event row — top-level accordion item
// ---------------------------------------------------------------------------

interface EventRowProps {
  ev: WebhookEvent;
  isNew: boolean;
}

function EventRow({ ev, isNew }: EventRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={clsx(
        "rounded-lg border bg-zinc-900 transition-all duration-300",
        open ? "border-zinc-600" : "border-zinc-800",
        isNew && "ring-1 ring-blue-500/50"
      )}
    >
      {/* Accordion trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {isNew && (
          <span className="inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400 animate-pulse" />
        )}
        <SourceBadge source={ev.source} />
        <span className="flex-1 truncate text-sm font-mono text-zinc-200">
          {ev.eventType}
        </span>
        <span className="text-[10px] text-zinc-500">{bytesFmt(ev.rawSize)}</span>
        <span className="min-w-[60px] text-right text-[10px] text-zinc-500">
          {relativeTime(ev.receivedAt)}
        </span>
        <svg
          className={clsx(
            "h-3 w-3 shrink-0 text-zinc-500 transition-transform duration-200",
            open && "rotate-180"
          )}
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path d="M4.427 6.427a.75.75 0 0 1 1.06 0L8 8.94l2.513-2.513a.75.75 0 0 1 1.06 1.06l-3.043 3.044a.75.75 0 0 1-1.06 0L4.427 7.487a.75.75 0 0 1 0-1.06Z" />
        </svg>
      </button>

      {/* Accordion content — nested AccordionSections */}
      <div
        className={clsx(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="border-t border-zinc-800 px-3 pb-3 pt-2 space-y-2">
          {/* Metadata row */}
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-zinc-500">
            <span className="font-mono truncate max-w-[200px]">{ev.id}</span>
            <span className="rounded bg-zinc-800 px-1 font-mono">{ev.method}</span>
            {ev.verified === true && (
              <span className="text-green-400">✓ HMAC verified</span>
            )}
            {ev.verified === false && (
              <span className="text-red-400">✗ unverified</span>
            )}
            <span>{new Date(ev.receivedAt).toLocaleTimeString()}</span>
          </div>

          {/* Headers accordion */}
          <AccordionSection
            title={`Headers (${Object.keys(ev.headers).length})`}
            defaultOpen={false}
          >
            <pre className="max-h-36 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-300 font-mono leading-relaxed">
              {JSON.stringify(ev.headers, null, 2)}
            </pre>
          </AccordionSection>

          {/* Body accordion */}
          <AccordionSection
            title={`Body · ${bytesFmt(ev.rawSize)}`}
            defaultOpen={true}
          >
            <div className="relative">
              <pre className="max-h-52 overflow-auto rounded bg-zinc-950 p-2 text-[10px] text-zinc-300 font-mono leading-relaxed">
                {ev.body === null
                  ? "(empty)"
                  : jsonPretty(ev.body)}
              </pre>
              {ev.body !== null && (
                <div className="absolute right-2 top-2">
                  <CopyButton text={jsonPretty(ev.body)} />
                </div>
              )}
            </div>
          </AccordionSection>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty / no-results states
// ---------------------------------------------------------------------------

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-zinc-600">
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
      <p className="text-sm">Waiting for events…</p>
      <p className="text-[11px]">POST a JSON payload to the endpoint above</p>
    </div>
  );
}

function NoResultsState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-zinc-600">
      <svg
        className="h-7 w-7"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z"
        />
      </svg>
      <p className="text-sm">No events match the active filters</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-1 rounded bg-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors"
      >
        Reset filters
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter state reducer (keeps mutations in one place)
// ---------------------------------------------------------------------------

type FilterAction =
  | { type: "TOGGLE_SOURCE"; source: WebhookSource }
  | { type: "SET_QUERY"; query: string }
  | { type: "SET_VERIFIED"; value: boolean | null }
  | { type: "SET_MIN_SIZE"; bytes: number }
  | { type: "RESET" };

function filterReducer(state: WebhookFilterState, action: FilterAction): WebhookFilterState {
  switch (action.type) {
    case "TOGGLE_SOURCE":  return toggleSource(state, action.source);
    case "SET_QUERY":      return setEventTypeQuery(state, action.query);
    case "SET_VERIFIED":   return setVerifiedOnly(state, action.value);
    case "SET_MIN_SIZE":   return setMinSizeBytes(state, action.bytes);
    case "RESET":          return resetFilter();
  }
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

interface WebhookInboxSSEProps {
  className?: string;
}

export function WebhookInboxSSE({ className }: WebhookInboxSSEProps) {
  const inbox = useWebhookInboxSSE();
  const [filter, dispatch] = useReducer(filterReducer, undefined, createDefaultFilter);
  const [filterOpen, setFilterOpen] = useState(false);

  // Track which event IDs are "new" (first 5 seconds after receipt)
  const [newIds] = useState(() => new Set<string>());

  // Derive endpoint URL
  const endpoint =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/integrations/webhook-inbox`
      : "/api/integrations/webhook-inbox";

  // Mark recent events as new (within 5 s)
  const now = Date.now();
  inbox.events.forEach((ev) => {
    if (now - ev.receivedAt < 5_000) newIds.add(ev.id);
    else newIds.delete(ev.id);
  });

  // Apply filters
  const filteredEvents = applyFilters(inbox.events, filter);
  const filterActive = isFilterActive(filter);

  const handleReset = useCallback(() => dispatch({ type: "RESET" }), []);

  return (
    <div
      className={clsx(
        "flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4",
        className
      )}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-100">
            Webhook Inbox
          </span>
          {/* Event counts — show filtered/total when filtered */}
          <span className="rounded-full bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
            {filterActive
              ? `${filteredEvents.length} / ${inbox.events.length}`
              : inbox.events.length}
          </span>
          <StatusBadge status={inbox.status} />
        </div>
        <div className="flex gap-1">
          {/* Filter toggle button */}
          <button
            type="button"
            onClick={() => setFilterOpen((o) => !o)}
            className={clsx(
              "relative flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
              filterOpen
                ? "bg-zinc-600 text-zinc-100"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 0a6.5 6.5 0 1 0 4.28 11.27l3.73 3.73a.75.75 0 1 0 1.06-1.06l-3.73-3.73A6.5 6.5 0 0 0 6.5 0Zm-5 6.5a5 5 0 1 1 10 0 5 5 0 0 1-10 0Z" />
            </svg>
            Filter
            {/* Active indicator dot */}
            {filterActive && !filterOpen && (
              <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-blue-400" />
            )}
          </button>
          <button
            onClick={inbox.reconnect}
            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 hover:bg-zinc-700 transition-colors"
          >
            Reconnect
          </button>
          <button
            onClick={() => void inbox.clear()}
            className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 hover:bg-zinc-700 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Endpoint bar */}
      <div className="flex items-center gap-2 rounded-lg bg-zinc-900 px-2 py-1.5">
        <span className="flex-1 truncate font-mono text-[11px] text-zinc-400">
          {endpoint}
        </span>
        <CopyButton text={endpoint} />
      </div>

      {/* Filter panel — collapsible */}
      <div
        className={clsx(
          "overflow-hidden transition-all duration-200",
          filterOpen ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <FilterControls
          filter={filter}
          allEvents={inbox.events}
          onToggleSource={(s) => dispatch({ type: "TOGGLE_SOURCE", source: s })}
          onEventTypeQuery={(q) => dispatch({ type: "SET_QUERY", query: q })}
          onVerifiedOnly={(v) => dispatch({ type: "SET_VERIFIED", value: v })}
          onMinSize={(b) => dispatch({ type: "SET_MIN_SIZE", bytes: b })}
          onReset={handleReset}
        />
      </div>

      {/* Error message */}
      {inbox.errorMessage && inbox.status !== "open" && (
        <p className="text-xs text-red-400">{inbox.errorMessage}</p>
      )}

      {/* Subscriber count hint */}
      {inbox.subscriberCount !== null && inbox.subscriberCount > 1 && (
        <p className="text-[10px] text-zinc-600">
          {inbox.subscriberCount} browser tab{inbox.subscriberCount !== 1 ? "s" : ""} connected
        </p>
      )}

      {/* Event list */}
      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[460px] pr-0.5">
        {inbox.events.length === 0 ? (
          <EmptyState />
        ) : filteredEvents.length === 0 ? (
          <NoResultsState onReset={handleReset} />
        ) : (
          filteredEvents.map((ev) => (
            <EventRow
              key={ev.id}
              ev={ev}
              isNew={newIds.has(ev.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
