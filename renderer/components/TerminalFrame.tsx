"use client";

import React, { useState, useRef } from "react";
import clsx from "clsx";

interface TerminalFrameProps {
  /** Slot: header (title, status dot, actions) */
  header?: React.ReactNode;
  /** Slot: main scrollable content */
  children?: React.ReactNode;
  /** Slot: footer (input area) */
  footer?: React.ReactNode;
  /** Neon color (e.g. '#22ff88', '#c084fc') */
  accentColor?: string;
  /** Optional CSS class for outer wrapper */
  className?: string;
  /** Optional callback when files are dropped */
  onFilesDropped?: (files: Array<{ file: File; path?: string }>) => void;
}

export function TerminalFrame({
  header,
  children,
  footer,
  accentColor = "#22ff88",
  className,
  onFilesDropped,
}: TerminalFrameProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types?.includes("Files")) {
      setIsDragging(true);
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCounterRef.current++;
    if (e.dataTransfer.types?.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        let path: string | undefined;
        // Try to get file path from Electron preload if available
        if (typeof window !== "undefined" && (window as any).ultronos?.getFilePathForDrop) {
          try {
            path = await (window as any).ultronos.getFilePathForDrop(file);
          } catch {
            // Fallback: no path available
          }
        }
        return { file, path };
      })
    );

    onFilesDropped?.(processedFiles);
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file && file.type.startsWith('image/')) {
          files.push(file);
        }
      }
    }

    if (files.length === 0) return;
    e.preventDefault();

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        let path: string | undefined;
        if (typeof window !== "undefined" && (window as any).ultronos?.getFilePathForDrop) {
          try {
            path = await (window as any).ultronos.getFilePathForDrop(file);
          } catch {
            // Fallback
          }
        }
        return { file, path };
      })
    );

    onFilesDropped?.(processedFiles);
  };

  return (
    <div
      ref={rootRef}
      className={clsx(
        "flex flex-col h-full rounded-xl border bg-[#05070d]/95 backdrop-blur-md overflow-hidden relative transition-all",
        isDragging && "ring-2 ring-offset-0",
        className
      )}
      style={{
        borderColor: isDragging ? accentColor : `${accentColor}33`,
        boxShadow: isDragging
          ? `0 0 24px ${accentColor}77, inset 0 0 32px ${accentColor}22`
          : `0 0 24px ${accentColor}22, inset 0 0 32px ${accentColor}11`,
      }}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={0}
    >
      {/* Scanlines overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay z-[1]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(to bottom, transparent 0px, transparent 1px, rgba(255,255,255,0.05) 2px, rgba(255,255,255,0.05) 4px)",
        }}
      />

      {/* Drag-over dashed border overlay */}
      {isDragging && (
        <div
          className="absolute inset-0 rounded-[10px] border-2 border-dashed pointer-events-none z-[2]"
          style={{ borderColor: accentColor, boxShadow: `inset 0 0 12px ${accentColor}33` }}
        >
          <div className="h-full flex items-center justify-center text-sm font-mono text-white/70">
            DROP FILES HERE
          </div>
        </div>
      )}

      {/* Header */}
      {header && (
        <div
          className="flex items-center justify-between border-b px-4 py-3 shrink-0 relative z-[3]"
          style={{ borderColor: `${accentColor}55` }}
        >
          {header}
        </div>
      )}

      {/* Content (scrollable) */}
      <div className="flex-1 overflow-y-auto min-h-0 relative z-[3]" style={{ scrollbarWidth: "thin" }}>
        {children}
      </div>

      {/* Footer */}
      {footer && (
        <div
          className="border-t px-3 py-3 shrink-0 relative z-[3]"
          style={{ borderColor: `${accentColor}33` }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
