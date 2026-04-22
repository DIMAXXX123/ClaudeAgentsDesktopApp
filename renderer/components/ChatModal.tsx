"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { X, Minus, Square } from "lucide-react";
import { Rnd } from "react-rnd";
import { AGENTS } from "@/lib/agents";
import { useAgentChat, type ToolEvent } from "@/lib/useAgentChat";
import { sfx } from "@/lib/sfx";
import { TerminalFrame } from "./TerminalFrame";

export function ChatModal({
  agentId,
  initialPrompt,
  onClose,
}: {
  agentId: string;
  initialPrompt?: string;
  onClose: () => void;
}) {
  const agent = AGENTS[agentId];
  const { messages, status, send, stop, reset } = useAgentChat(agentId);
  const [input, setInput] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<Array<{ file: File; path?: string }>>([]);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 720, height: 560 });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const prevGeoRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSentRef = useRef<string | null>(null);
  const stickToBottomRef = useRef(true);

  useEffect(() => {
    sfx.open();

    const stored = localStorage.getItem("ultronos.chatmodal.geometry");
    if (stored) {
      try {
        const geo = JSON.parse(stored);
        if (geo[agentId]) {
          const { x, y, w, h } = geo[agentId];
          setPosition({ x, y });
          setSize({ width: w, height: h });
        } else {
          centerWindow();
        }
      } catch {
        centerWindow();
      }
    } else {
      centerWindow();
    }
  }, [agentId]);

  useEffect(() => {
    if (!initialPrompt) return;
    if (autoSentRef.current === initialPrompt) return;
    autoSentRef.current = initialPrompt;
    const t = setTimeout(() => send(initialPrompt), 250);
    return () => clearTimeout(t);
  }, [initialPrompt, send]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  const handleSend = (text: string) => {
    if (!text.trim() || status === "working") return;
    send(text, attachedFiles.length > 0 ? attachedFiles : undefined);
    setInput("");
    setAttachedFiles([]);
  };

  const handleFilesDropped = (files: Array<{ file: File; path?: string }>) => {
    setAttachedFiles((prev) => [...prev, ...files]);
  };

  const removeAttachedFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const centerWindow = () => {
    const width = 720;
    const height = 560;
    setPosition({
      x: (typeof window !== "undefined" ? window.innerWidth : 1920) / 2 - width / 2,
      y: (typeof window !== "undefined" ? window.innerHeight : 1080) / 2 - height / 2,
    });
    setSize({ width, height });
  };

  const handleSaveGeometry = (x: number, y: number, w: number, h: number) => {
    const stored = localStorage.getItem("ultronos.chatmodal.geometry");
    const geo = stored ? JSON.parse(stored) : {};
    geo[agentId] = { x, y, w, h };
    localStorage.setItem("ultronos.chatmodal.geometry", JSON.stringify(geo));
  };

  const toggleMaximize = () => {
    if (isMaximized) {
      if (prevGeoRef.current) {
        setPosition({ x: prevGeoRef.current.x, y: prevGeoRef.current.y });
        setSize({ width: prevGeoRef.current.w, height: prevGeoRef.current.h });
      }
      setIsMaximized(false);
    } else {
      prevGeoRef.current = { x: position.x, y: position.y, w: size.width, h: size.height };
      setPosition({ x: 0, y: 0 });
      setSize({ width: window.innerWidth, height: window.innerHeight });
      setIsMaximized(true);
    }
  };

  return (
    <Rnd
      position={position}
      size={size}
      onDragStop={(_e, d) => {
        setPosition({ x: d.x, y: d.y });
        handleSaveGeometry(d.x, d.y, size.width, size.height);
      }}
      onResizeStop={(_e, _direction, ref) => {
        const w = ref.offsetWidth;
        const h = ref.offsetHeight;
        setSize({ width: w, height: h });
        handleSaveGeometry(position.x, position.y, w, h);
      }}
      minWidth={480}
      minHeight={360}
      maxWidth={1200}
      maxHeight={900}
      dragHandleClassName={isMaximized ? "" : "chat-modal-titlebar"}
      disableDragging={isMaximized}
      enableResizing={!isMaximized}
      className="relative z-50"
    >
      <div className="flex flex-col h-full bg-black/40 border rounded-sm overflow-hidden" style={{ borderColor: `${agent.color}55` }}>
        <div className="chat-modal-titlebar flex items-center justify-between w-full px-4 py-2 cursor-move select-none" style={{ borderBottom: `1px solid ${agent.color}33`, background: `${agent.color}10` }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className={clsx(
                "flex h-8 w-8 items-center justify-center rounded-sm border text-lg shrink-0",
                status === "working" && "animate-pulse",
              )}
              style={{ borderColor: `${agent.color}99`, background: `${agent.color}20` }}
            >
              {agent.emoji}
            </div>
            <div className="min-w-0">
              <div className="pixel text-xs tracking-widest truncate" style={{ color: agent.color, textShadow: `0 0 8px ${agent.color}` }}>
                {agent.name}
              </div>
              <div className="text-[9px] uppercase tracking-widest text-white/40 truncate">
                {agent.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <StatusBadge status={status} color={agent.color} />
            <button
              onClick={reset}
              className="rounded-sm border border-white/20 px-1.5 py-0.5 text-[9px] uppercase text-white/60 hover:border-white/60 hover:text-white transition"
              title="New session"
            >
              NEW
            </button>
            <button
              onClick={toggleMaximize}
              className="rounded-sm border border-white/20 px-1.5 py-0.5 text-white/60 hover:text-white hover:border-white/60 transition inline-flex items-center justify-center"
              title={isMaximized ? "Restore" : "Maximize"}
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="rounded-sm border border-white/20 px-1.5 py-0.5 text-white/60 hover:text-white hover:border-white/60 transition inline-flex items-center justify-center"
              title={isMinimized ? "Restore" : "Minimize"}
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="rounded-sm border px-1.5 py-0.5 text-[9px] uppercase hover:bg-white/10 inline-flex items-center justify-center transition"
              style={{ borderColor: `${agent.color}99`, color: agent.color }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <TerminalFrame
            accentColor={agent.color}
            onFilesDropped={handleFilesDropped}
            header={undefined}
            footer={
              <div className="space-y-2">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((af, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 rounded-sm border px-2 py-1 text-[10px]"
                        style={{ borderColor: `${agent.color}55`, background: `${agent.color}15` }}
                      >
                        {af.file.type.startsWith("image/") ? "🖼" : "📄"}
                        <span className="truncate max-w-[120px]">{af.file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachedFile(idx)}
                          className="ml-1 text-white/50 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend(input);
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={status === "working"}
                    placeholder={status === "working" ? "AGENT WORKING..." : `Commander → ${agent.name}...`}
                    className="flex-1 rounded-sm border bg-black/60 px-3 py-2 text-[13px] text-white placeholder:text-white/30 focus:outline-none focus:ring-1 disabled:opacity-50"
                    style={{ borderColor: `${agent.color}55`, caretColor: agent.color }}
                  />
                  {status === "working" ? (
                    <button
                      type="button"
                      onClick={stop}
                      className="rounded-sm border border-neon-red/70 bg-neon-red/10 px-3 py-2 text-[11px] font-bold uppercase text-neon-red hover:bg-neon-red/20 shrink-0"
                    >
                      STOP
                    </button>
                  ) : (
                    <button
                      type="submit"
                      className="rounded-sm border px-3 py-2 text-[11px] font-bold uppercase hover:bg-white/5 shrink-0"
                      style={{ borderColor: `${agent.color}99`, color: agent.color }}
                    >
                      SEND ►
                    </button>
                  )}
                </form>
              </div>
            }
          >
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="space-y-4 px-4 py-4 font-mono text-[13px]"
            >
              {messages.length === 0 && (
                <div className="mt-10 flex flex-col items-center gap-2 text-center">
                  <div className="text-4xl opacity-60">{agent.emoji}</div>
                  <div className="pixel text-sm" style={{ color: agent.color }}>
                    {agent.greeting}
                  </div>
                  <div className="text-[10px] text-white/40 mt-2">
                    Tools: {agent.allowedTools.join(" · ")}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {suggestions(agentId).map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="rounded-sm border border-white/20 bg-white/5 px-2 py-1 text-[10px] uppercase text-white/60 hover:border-white/60 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <UserBubble key={i} text={m.text} />
                ) : (
                  <AssistantBubble key={i} text={m.text} tools={m.tools} color={agent.color} />
                ),
              )}
            </div>
          </TerminalFrame>
        )}
      </div>
    </Rnd>
  );
}

function StatusBadge({ status, color }: { status: string; color: string }) {
  const map = {
    idle: { text: "ONLINE", dot: "#22ff88" },
    working: { text: "EXECUTING", dot: color },
    error: { text: "ERROR", dot: "#ff3a5e" },
  } as const;
  const s = map[status as keyof typeof map] ?? map.idle;
  return (
    <div className="hidden items-center gap-2 rounded-sm border border-white/20 bg-black/40 px-2 py-1 text-[10px] uppercase tracking-widest text-white/70 md:flex">
      <span
        className={clsx("h-1.5 w-1.5 rounded-full", status === "working" && "animate-ping")}
        style={{ background: s.dot, boxShadow: `0 0 6px ${s.dot}` }}
      />
      {s.text}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-sm border border-neon-purple/50 bg-neon-purple/10 px-3 py-2 text-white">
        <div className="pixel mb-1 text-[9px] text-neon-purple">COMMANDER ►</div>
        <div className="whitespace-pre-wrap">{text}</div>
      </div>
    </div>
  );
}

function AssistantBubble({
  text,
  tools,
  color,
}: {
  text: string;
  tools: ToolEvent[];
  color: string;
}) {
  return (
    <div className="flex justify-start">
      <div
        className="max-w-[85%] space-y-2 rounded-sm border bg-black/30 px-3 py-2"
        style={{ borderColor: `${color}55` }}
      >
        {tools.map((t) => (
          <ToolCard key={t.id || Math.random()} tool={t} color={color} />
        ))}
        {text && <div className="whitespace-pre-wrap text-white/90">{text}</div>}
        {!text && tools.length === 0 && (
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full" style={{ background: color }} />
            <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.15s]" style={{ background: color }} />
            <span className="h-2 w-2 animate-bounce rounded-full [animation-delay:0.3s]" style={{ background: color }} />
          </div>
        )}
      </div>
    </div>
  );
}

function ToolCard({ tool, color }: { tool: ToolEvent; color: string }) {
  const [open, setOpen] = useState(false);
  const label = previewInput(tool.name, tool.input);
  return (
    <div
      className={clsx(
        "rounded-sm border text-[11px] font-mono",
        tool.isError ? "border-neon-red/60 bg-neon-red/10" : "border-white/15 bg-black/50",
      )}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-2 py-1 text-left">
        <span style={{ color }} className="pixel text-[9px]">
          ⚙ {tool.name}
        </span>
        <span className="flex-1 truncate text-white/60">{label}</span>
        {tool.output === undefined ? (
          <span className="text-[9px] text-neon-yellow animate-pulse">RUNNING</span>
        ) : tool.isError ? (
          <span className="text-[9px] text-neon-red">ERR</span>
        ) : (
          <span className="text-[9px] text-neon-green">OK</span>
        )}
        <span className="text-white/40">{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div className="border-t border-white/10 p-2 space-y-2">
          <div>
            <div className="pixel text-[8px] text-white/40">INPUT</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[10px] text-white/70">
              {JSON.stringify(tool.input, null, 2)}
            </pre>
          </div>
          {tool.output !== undefined && (
            <div>
              <div className="pixel text-[8px] text-white/40">OUTPUT</div>
              <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words text-[10px] text-white/70">
                {tool.output}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function previewInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;
  if (name === "Bash" && typeof obj.command === "string") return obj.command;
  if ((name === "Read" || name === "Edit" || name === "Write") && typeof obj.file_path === "string")
    return obj.file_path as string;
  if (name === "Grep" && typeof obj.pattern === "string") return obj.pattern;
  if (name === "Glob" && typeof obj.pattern === "string") return obj.pattern;
  if (name === "WebFetch" && typeof obj.url === "string") return obj.url;
  return JSON.stringify(obj).slice(0, 80);
}

function suggestions(agentId: string): string[] {
  const common = ["Открой терминал"];
  switch (agentId) {
    case "ultron":
      return [...common, "Покажи что в папке ~/Documents", "Запусти calc"];
    case "nova":
      return ["Найди все TODO в проекте", "Просканируй структуру sandbox"];
    case "forge":
      return ["Создай hello.js с console.log и запусти", "Сделай новый next.js app в sandbox"];
    case "ares":
      return ["Проверь почему node процессы живые", "Покажи последние ошибки в eventlog"];
    case "echo":
      return ["Пинганi google.com", "Сделай GET на https://api.github.com"];
    case "midas":
      return ["Посчитай размер sandbox в МБ", "Покажи топ 10 больших файлов"];
    default:
      return common;
  }
}
