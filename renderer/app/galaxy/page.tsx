"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MemoryGalaxyTabs } from "@/components/galaxy/MemoryGalaxyTabs";
import type { MemoryGraph } from "@/lib/memoryGalaxy";

type ApiResponse =
  | { ok: true; graph: MemoryGraph; sourceDir: string; count: number }
  | { ok: false; error: string; sourceDir: string };

export default function GalaxyPage() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/memory-galaxy")
      .then((r) => r.json() as Promise<ApiResponse>)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setData({ ok: false, error: String(e), sourceDir: "" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex h-screen w-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-white/10 px-4 py-2 font-mono text-xs">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/50 hover:text-white">
            ← ULTRONOS
          </Link>
          <span className="text-white/30">/</span>
          <span className="uppercase tracking-[0.3em] text-white">Memory Galaxy</span>
        </div>
        {data?.ok && (
          <div className="text-white/40">
            {data.count} files · {data.sourceDir}
          </div>
        )}
      </header>
      <section className="relative flex-1">
        {!data && (
          <div className="absolute inset-0 flex items-center justify-center font-mono text-xs text-white/50">
            loading memory…
          </div>
        )}
        {data?.ok === false && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-8 font-mono text-xs text-red-300">
            <div>Failed to load memory:</div>
            <pre className="max-w-xl whitespace-pre-wrap text-center text-white/60">{data.error}</pre>
            <div className="text-white/40">source: {data.sourceDir}</div>
          </div>
        )}
        {data?.ok && <MemoryGalaxyTabs graph={data.graph} />}
      </section>
    </main>
  );
}
