"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  NODE_COLOR,
  type MemoryEdge,
  type MemoryGraph,
  type MemoryNode,
  type NodeType,
} from "@/lib/memoryGalaxy";
import {
  createPhysicsEdges,
  createPhysicsState,
  physicsStep,
  type PhysicsEdges,
  type PhysicsState,
} from "@/lib/memoryLayout";

type Props = {
  graph: MemoryGraph;
};

const TYPE_LABEL: Record<NodeType, string> = {
  index: "Index",
  user: "User memory",
  feedback: "Feedback",
  project: "Project",
  reference: "Reference",
  skill: "Skill",
  agent: "Agent",
  command: "Command",
  rule: "Rule",
  hook: "Hook",
  plan: "Plan",
  "output-style": "Output style",
  "claude-md": "CLAUDE.md",
  "plugin-skill": "Plugin skill",
  "plugin-command": "Plugin cmd",
  "plugin-agent": "Plugin agent",
  unknown: "Other",
};

const MIN_SCALE = 0.2;
const MAX_SCALE = 6;
const MAX_DPR = 1.5;
const LABEL_SCALE_THRESHOLD = 1.9;
const PRESETTLE_STEPS = 300;
const ALPHA_INITIAL = 1;
const ALPHA_MIN = 0.001;
const ALPHA_DECAY = 0.985;
const ALPHA_DRAG = 0.35;
const ALPHA_REHEAT = 0.6;

type Camera = { scale: number; ox: number; oy: number };

export function MemoryGalaxy({ graph }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 960, h: 640 });
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NodeType | null>(null);
  const [camera, setCamera] = useState<Camera>({ scale: 1, ox: 0, oy: 0 });
  const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const dragNodeRef = useRef<{ idx: number; wx: number; wy: number } | null>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDims({ w: Math.max(320, Math.floor(r.width)), h: Math.max(320, Math.floor(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const adjacency = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const n of graph.nodes) m.set(n.id, new Set());
    for (const e of graph.edges) {
      m.get(e.source)?.add(e.target);
      m.get(e.target)?.add(e.source);
    }
    return m;
  }, [graph]);

  const idIndex = useMemo(() => {
    const m = new Map<string, number>();
    graph.nodes.forEach((n, i) => m.set(n.id, i));
    return m;
  }, [graph.nodes]);

  const staticData = useMemo(() => {
    const n = graph.nodes.length;
    const radius = new Float32Array(n);
    const types: NodeType[] = new Array(n);
    const colors: string[] = new Array(n);
    const names: string[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const nd = graph.nodes[i];
      radius[i] = nodeRadius(nd);
      types[i] = nd.type;
      colors[i] = NODE_COLOR[nd.type];
      names[i] = nd.name;
    }
    return { radius, types, colors, names };
  }, [graph.nodes]);

  const physicsRef = useRef<PhysicsState | null>(null);
  const physicsEdgesRef = useRef<PhysicsEdges | null>(null);
  const alphaRef = useRef<number>(ALPHA_INITIAL);

  useEffect(() => {
    const state = createPhysicsState(graph, { width: dims.w, height: dims.h, seed: 7 });
    const edges = createPhysicsEdges(graph, idIndex);
    const opts = { width: dims.w, height: dims.h };
    let alpha = ALPHA_INITIAL;
    for (let i = 0; i < PRESETTLE_STEPS; i++) {
      physicsStep(state, edges, opts, -1, 0, 0, alpha);
      alpha *= ALPHA_DECAY;
      if (alpha < ALPHA_MIN) alpha = ALPHA_MIN;
    }
    physicsRef.current = state;
    physicsEdgesRef.current = edges;
    alphaRef.current = ALPHA_MIN;
  }, [graph, idIndex, dims.w, dims.h]);

  const visibleSet = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasQ = q.length > 0;
    if (!hasQ && !typeFilter) return null;
    const s = new Set<string>();
    for (const n of graph.nodes) {
      if (typeFilter && n.type !== typeFilter) continue;
      if (hasQ) {
        const match =
          n.name.toLowerCase().includes(q) ||
          n.id.toLowerCase().includes(q) ||
          n.tags.some((t) => t.includes(q)) ||
          n.description.toLowerCase().includes(q);
        if (!match) continue;
      }
      s.add(n.id);
    }
    return s;
  }, [graph.nodes, query, typeFilter]);

  const edgeIndices = useMemo(() => {
    const out: { si: number; ti: number; kind: MemoryEdge["kind"] }[] = [];
    for (const e of graph.edges) {
      const si = idIndex.get(e.source);
      const ti = idIndex.get(e.target);
      if (si === undefined || ti === undefined) continue;
      out.push({ si, ti, kind: e.kind });
    }
    return out;
  }, [graph.edges, idIndex]);

  const highlight = hover ?? selected;

  const stateRef = useRef({
    camera,
    highlight,
    highlightIdx: null as number | null,
    visibleSet,
    highlightNeighbors: null as Set<string> | null,
    dims,
  });
  stateRef.current = {
    camera,
    highlight,
    highlightIdx: highlight ? (idIndex.get(highlight) ?? null) : null,
    visibleSet,
    highlightNeighbors: highlight ? (adjacency.get(highlight) ?? null) : null,
    dims,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    canvas.width = Math.round(dims.w * dpr);
    canvas.height = Math.round(dims.h * dpr);
    canvas.style.width = `${dims.w}px`;
    canvas.style.height = `${dims.h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let raf = 0;

    const tick = () => {
      const state = physicsRef.current;
      const edges = physicsEdgesRef.current;
      const { camera: cam, highlightIdx, highlightNeighbors: hn, visibleSet: vs, dims: d } = stateRef.current;

      if (state && edges) {
        const opts = { width: d.w, height: d.h };
        const drag = dragNodeRef.current;
        if (drag) {
          if (alphaRef.current < ALPHA_DRAG) alphaRef.current = ALPHA_DRAG;
        }
        if (alphaRef.current > ALPHA_MIN) {
          physicsStep(
            state,
            edges,
            opts,
            drag ? drag.idx : -1,
            drag ? drag.wx : 0,
            drag ? drag.wy : 0,
            alphaRef.current,
          );
          alphaRef.current *= ALPHA_DECAY;
          if (alphaRef.current < ALPHA_MIN) alphaRef.current = ALPHA_MIN;
        } else if (drag) {
          physicsStep(state, edges, opts, drag.idx, drag.wx, drag.wy, ALPHA_MIN);
        }
      }

      if (state) {
        drawGalaxy(ctx, {
          dims: d,
          state,
          staticData,
          edgeIndices,
          highlightIdx,
          highlightNeighbors: hn,
          visibleSet: vs,
          hasFilter: vs !== null,
          camera: cam,
          idIndex,
        });
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [dims, staticData, edgeIndices, idIndex]);

  const screenToWorld = (sx: number, sy: number) => {
    return {
      x: (sx - dims.w / 2) / camera.scale - camera.ox + dims.w / 2,
      y: (sy - dims.h / 2) / camera.scale - camera.oy + dims.h / 2,
    };
  };

  const hitTest = (clientX: number, clientY: number): number | null => {
    const canvas = canvasRef.current;
    const state = physicsRef.current;
    if (!canvas || !state) return null;
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    const wp = screenToWorld(sx, sy);
    const pad = 4 / camera.scale;
    let best = -1;
    let bestDistSq = Infinity;
    const n = state.x.length;
    for (let i = 0; i < n; i++) {
      const ex = state.x[i] - wp.x;
      const ey = state.y[i] - wp.y;
      const r = staticData.radius[i] + pad;
      const distSq = ex * ex + ey * ey;
      if (distSq <= r * r && distSq < bestDistSq) {
        best = i;
        bestDistSq = distSq;
      }
    }
    return best >= 0 ? best : null;
  };

  const selectedNode = selected ? nodeMap.get(selected) : null;
  const hoverNode = hover ? nodeMap.get(hover) : null;

  const hoverScreen = useMemo(() => {
    if (!hover) return null;
    const idx = idIndex.get(hover);
    const state = physicsRef.current;
    if (idx === undefined || !state) return null;
    const wx = state.x[idx];
    const wy = state.y[idx];
    return {
      x: (wx - dims.w / 2 + camera.ox) * camera.scale + dims.w / 2,
      y: (wy - dims.h / 2 + camera.oy) * camera.scale + dims.h / 2,
    };
  }, [hover, idIndex, camera, dims.w, dims.h]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelected(null);
        setTypeFilter(null);
      }
      if (e.key === "0") setCamera({ scale: 1, ox: 0, oy: 0 });
      if (e.key === "r" || e.key === "R") alphaRef.current = ALPHA_REHEAT;
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [setSelected, setTypeFilter, setCamera]);

  const counts = useMemo(() => {
    const out: Partial<Record<NodeType, number>> = {};
    for (const n of graph.nodes) out[n.type] = (out[n.type] ?? 0) + 1;
    return out;
  }, [graph.nodes]);

  if (graph.nodes.length === 0) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#0a0a0a] font-mono text-xs text-white/40">
        no memory nodes — check source dirs on server
      </div>
    );
  }

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const before = screenToWorld(sx, sy);
    const factor = Math.exp(-e.deltaY * 0.0015);
    const nextScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, camera.scale * factor));
    const nextOx = (sx - dims.w / 2) / nextScale - before.x + dims.w / 2;
    const nextOy = (sy - dims.h / 2) / nextScale - before.y + dims.h / 2;
    setCamera({ scale: nextScale, ox: nextOx, oy: nextOy });
  };

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    const idx = hitTest(e.clientX, e.clientY);
    if (idx !== null) {
      const state = physicsRef.current;
      if (state) {
        dragNodeRef.current = { idx, wx: state.x[idx], wy: state.y[idx] };
        alphaRef.current = Math.max(alphaRef.current, ALPHA_DRAG);
      }
      setSelected(graph.nodes[idx].id);
      return;
    }
    dragRef.current = { x: e.clientX, y: e.clientY, ox: camera.ox, oy: camera.oy };
  };

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (dragNodeRef.current && rect) {
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const wp = screenToWorld(sx, sy);
      dragNodeRef.current = { idx: dragNodeRef.current.idx, wx: wp.x, wy: wp.y };
      alphaRef.current = Math.max(alphaRef.current, ALPHA_DRAG);
      return;
    }
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.x) / camera.scale;
      const dy = (e.clientY - dragRef.current.y) / camera.scale;
      const nextOx = dragRef.current.ox + dx;
      const nextOy = dragRef.current.oy + dy;
      if (Math.abs(nextOx - camera.ox) > 0.3 || Math.abs(nextOy - camera.oy) > 0.3) {
        setCamera((c) => ({ ...c, ox: nextOx, oy: nextOy }));
      }
      return;
    }
    const idx = hitTest(e.clientX, e.clientY);
    const id = idx !== null ? graph.nodes[idx].id : null;
    if (id !== hover) setHover(id);
  };

  const onMouseUp = () => {
    dragRef.current = null;
    dragNodeRef.current = null;
  };

  const onMouseLeave = () => {
    setHover(null);
    dragRef.current = null;
    dragNodeRef.current = null;
  };

  const cursor = dragRef.current
    ? "grabbing"
    : dragNodeRef.current
      ? "grabbing"
      : hover
        ? "pointer"
        : "grab";

  return (
    <div ref={wrapperRef} className="relative h-full w-full overflow-hidden bg-[#0a0a0a]">
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        style={{ cursor }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (!t) return;
          const idx = hitTest(t.clientX, t.clientY);
          if (idx !== null) {
            const state = physicsRef.current;
            if (state) dragNodeRef.current = { idx, wx: state.x[idx], wy: state.y[idx] };
            setSelected(graph.nodes[idx].id);
            setHover(graph.nodes[idx].id);
          }
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (!t) return;
          const rect = canvasRef.current?.getBoundingClientRect();
          if (dragNodeRef.current && rect) {
            const wp = screenToWorld(t.clientX - rect.left, t.clientY - rect.top);
            dragNodeRef.current = { idx: dragNodeRef.current.idx, wx: wp.x, wy: wp.y };
            alphaRef.current = Math.max(alphaRef.current, ALPHA_DRAG);
          }
        }}
        onTouchEnd={() => {
          dragNodeRef.current = null;
        }}
        aria-label="Memory galaxy"
      />

      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2 text-xs">
        <div className="pointer-events-auto rounded-md border border-white/10 bg-black/60 px-3 py-2 backdrop-blur">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Memory Galaxy</div>
          <div className="mt-1 font-mono text-white/80">
            {graph.nodes.length} nodes · {graph.edges.length} edges · ×{camera.scale.toFixed(2)}
          </div>
          <div className="mt-0.5 font-mono text-[10px] text-white/40">
            scroll=zoom · drag-bg=pan · drag-node=move · 0=reset · r=reheat · esc=clear
          </div>
        </div>
        <div className="pointer-events-auto rounded-md border border-white/10 bg-black/60 p-2 backdrop-blur">
          <input
            type="search"
            placeholder="search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-44 rounded-sm bg-transparent px-2 py-1 font-mono text-[11px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 max-h-[75%] overflow-auto rounded-md border border-white/10 bg-black/60 px-3 py-2 font-mono text-[10px] backdrop-blur">
        <div className="mb-1 uppercase tracking-[0.2em] text-white/50">Legend · click to filter</div>
        {(Object.keys(TYPE_LABEL) as NodeType[])
          .filter((t) => (counts[t] ?? 0) > 0)
          .map((t) => {
            const active = typeFilter === t;
            return (
              <button
                key={t}
                onClick={() => setTypeFilter(active ? null : t)}
                className={`flex w-full items-center gap-2 py-0.5 text-left ${active ? "text-white" : "text-white/70 hover:text-white"}`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    background: NODE_COLOR[t],
                    opacity: active || !typeFilter ? 1 : 0.35,
                  }}
                />
                <span>{TYPE_LABEL[t]}</span>
                <span className="ml-auto text-white/40">{counts[t]}</span>
              </button>
            );
          })}
        {typeFilter && (
          <button
            onClick={() => setTypeFilter(null)}
            className="mt-1 w-full rounded border border-white/15 px-1 py-0.5 text-center text-white/60 hover:text-white"
          >
            clear filter
          </button>
        )}
      </div>

      {hoverNode && hoverScreen && !selectedNode && (
        <div
          className="pointer-events-none absolute max-w-xs rounded-md border border-white/15 bg-black/85 px-3 py-2 font-mono text-xs text-white shadow-xl backdrop-blur"
          style={{
            left: Math.min(Math.max(8, hoverScreen.x + 14), dims.w - 280),
            top: Math.min(Math.max(8, hoverScreen.y + 14), dims.h - 120),
          }}
        >
          <div className="text-[10px] uppercase tracking-widest" style={{ color: NODE_COLOR[hoverNode.type] }}>
            {TYPE_LABEL[hoverNode.type]} · deg {hoverNode.degree}
          </div>
          <div className="mt-0.5 text-white">{hoverNode.name}</div>
          <div className="mt-0.5 truncate text-[10px] text-white/40">{hoverNode.id}</div>
          {hoverNode.description && (
            <div className="mt-1 line-clamp-3 text-white/60">{hoverNode.description}</div>
          )}
          {hoverNode.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {hoverNode.tags.slice(0, 6).map((t) => (
                <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedNode && (
        <div className="absolute right-4 bottom-4 max-h-[60%] w-80 overflow-auto rounded-md border border-white/15 bg-black/90 p-4 font-mono text-xs text-white backdrop-blur">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-widest" style={{ color: NODE_COLOR[selectedNode.type] }}>
                {TYPE_LABEL[selectedNode.type]}
              </div>
              <div className="mt-0.5 text-base text-white">{selectedNode.name}</div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="rounded border border-white/20 px-2 py-0.5 text-[10px] text-white/60 hover:text-white"
              aria-label="close"
            >
              ×
            </button>
          </div>
          <div className="mt-1 truncate text-white/40">{selectedNode.id}</div>
          {selectedNode.description && <div className="mt-2 text-white/80">{selectedNode.description}</div>}
          {selectedNode.tags.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-white/40">Tags</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {selectedNode.tags.map((t) => (
                  <span key={t} className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="mt-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              Connections ({adjacency.get(selectedNode.id)?.size ?? 0})
            </div>
            <div className="mt-1 flex flex-col gap-1">
              {[...(adjacency.get(selectedNode.id) ?? [])]
                .map((id) => nodeMap.get(id))
                .filter((n): n is MemoryNode => Boolean(n))
                .slice(0, 40)
                .map((n) => (
                  <button
                    key={n.id}
                    onClick={() => setSelected(n.id)}
                    className="flex items-center gap-2 rounded border border-white/5 bg-white/5 px-2 py-1 text-left text-white/80 hover:bg-white/10"
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ background: NODE_COLOR[n.type] }}
                    />
                    <span className="truncate">{n.name}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function nodeRadius(node: MemoryNode): number {
  const base = node.type === "index" ? 6 : node.type === "claude-md" ? 5 : 2.6;
  return Math.min(base + node.degree * 0.22, 8.5);
}

type StaticData = {
  radius: Float32Array;
  types: NodeType[];
  colors: string[];
  names: string[];
};

type EdgeIndex = { si: number; ti: number; kind: MemoryEdge["kind"] };

type DrawArgs = {
  dims: { w: number; h: number };
  state: PhysicsState;
  staticData: StaticData;
  edgeIndices: EdgeIndex[];
  highlightIdx: number | null;
  highlightNeighbors: Set<string> | null;
  visibleSet: Set<string> | null;
  hasFilter: boolean;
  camera: Camera;
  idIndex: Map<string, number>;
};

function drawGalaxy(ctx: CanvasRenderingContext2D, a: DrawArgs) {
  const {
    dims,
    state,
    staticData,
    edgeIndices,
    highlightIdx,
    highlightNeighbors,
    visibleSet,
    hasFilter,
    camera,
  } = a;

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, dims.w, dims.h);

  const invScale = 1 / camera.scale;
  const halfW = dims.w / 2;
  const halfH = dims.h / 2;
  const viewMargin = 60 * invScale;
  const viewLeft = halfW - halfW * invScale - camera.ox - viewMargin;
  const viewRight = halfW + halfW * invScale - camera.ox + viewMargin;
  const viewTop = halfH - halfH * invScale - camera.oy - viewMargin;
  const viewBottom = halfH + halfH * invScale - camera.oy + viewMargin;

  ctx.save();
  ctx.translate(halfW, halfH);
  ctx.scale(camera.scale, camera.scale);
  ctx.translate(-halfW + camera.ox, -halfH + camera.oy);

  const n = state.x.length;
  const highlightNb = highlightNeighbors;
  const anyFilter = highlightIdx !== null || hasFilter;

  const neighborIdxSet = buildIdxSet(highlightNb, a.idIndex);

  const visibleIdx = (i: number) =>
    state.x[i] >= viewLeft &&
    state.x[i] <= viewRight &&
    state.y[i] >= viewTop &&
    state.y[i] <= viewBottom;

  const visibleMatchesFilter = (idx: number) => {
    if (!visibleSet) return true;
    return visibleSet.has(state.ids[idx]);
  };

  const skipTagEdges = highlightIdx === null && camera.scale < 0.7;

  const baseEdge: { stroke: string; width: number; segments: number[] } = {
    stroke: "rgba(140,150,170,0.12)",
    width: 0.7 * invScale,
    segments: [],
  };
  const highlightEdge: { stroke: string; width: number; segments: number[] } = {
    stroke: "rgba(255,255,255,0.85)",
    width: 1.4 * invScale,
    segments: [],
  };

  for (let k = 0; k < edgeIndices.length; k++) {
    const e = edgeIndices[k];
    if (skipTagEdges && e.kind === "tag") continue;
    const related = highlightIdx !== null && (e.si === highlightIdx || e.ti === highlightIdx);
    if (highlightIdx !== null && !related) continue;
    if (hasFilter && !related && (!visibleMatchesFilter(e.si) || !visibleMatchesFilter(e.ti))) continue;

    const sv = visibleIdx(e.si);
    const tv = visibleIdx(e.ti);
    if (!sv && !tv) continue;

    const bucket = related ? highlightEdge : baseEdge;
    bucket.segments.push(state.x[e.si], state.y[e.si], state.x[e.ti], state.y[e.ti]);
  }

  for (const batch of [baseEdge, highlightEdge]) {
    if (batch.segments.length === 0) continue;
    ctx.strokeStyle = batch.stroke;
    ctx.lineWidth = batch.width;
    ctx.beginPath();
    const seg = batch.segments;
    for (let i = 0; i < seg.length; i += 4) {
      ctx.moveTo(seg[i], seg[i + 1]);
      ctx.lineTo(seg[i + 2], seg[i + 3]);
    }
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    if (!visibleIdx(i)) continue;
    const isHighlight = i === highlightIdx;
    const isNeighbor = neighborIdxSet?.has(i) ?? false;
    const inFilter = visibleMatchesFilter(i);
    const alpha =
      highlightIdx !== null
        ? isHighlight || isNeighbor
          ? 1
          : 0.18
        : anyFilter
          ? inFilter
            ? 1
            : 0.15
          : 0.92;

    ctx.globalAlpha = alpha;
    ctx.fillStyle = staticData.colors[i];
    ctx.beginPath();
    ctx.arc(state.x[i], state.y[i], staticData.radius[i], 0, Math.PI * 2);
    ctx.fill();

    if (isHighlight) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 1.4 * invScale;
      ctx.beginPath();
      ctx.arc(state.x[i], state.y[i], staticData.radius[i] + 3, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  const showLabels = camera.scale >= LABEL_SCALE_THRESHOLD || highlightIdx !== null;
  if (showLabels) {
    ctx.font = `${11 * invScale}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    ctx.textBaseline = "top";
    ctx.textAlign = "center";
    const labelPad = 3 * invScale;
    for (let i = 0; i < n; i++) {
      if (!visibleIdx(i)) continue;
      const isHighlight = i === highlightIdx;
      const isNeighbor = neighborIdxSet?.has(i) ?? false;
      const showThis = camera.scale >= LABEL_SCALE_THRESHOLD || isHighlight || isNeighbor;
      if (!showThis) continue;
      const name = staticData.names[i];
      if (!name) continue;
      const x = state.x[i];
      const y = state.y[i] + staticData.radius[i] + labelPad;
      ctx.globalAlpha = isHighlight ? 1 : isNeighbor ? 0.9 : 0.7;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      const m = ctx.measureText(name);
      const tw = m.width + 6 * invScale;
      const th = 14 * invScale;
      ctx.fillRect(x - tw / 2, y, tw, th);
      ctx.fillStyle = "#e5e7eb";
      ctx.fillText(name, x, y + 1.5 * invScale);
    }
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function buildIdxSet(ids: Set<string> | null, idIndex: Map<string, number>): Set<number> | null {
  if (!ids) return null;
  const out = new Set<number>();
  for (const id of ids) {
    const i = idIndex.get(id);
    if (i !== undefined) out.add(i);
  }
  return out;
}
