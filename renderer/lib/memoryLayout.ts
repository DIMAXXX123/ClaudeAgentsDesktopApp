import type { MemoryGraph, NodeType } from "./memoryGalaxy";

export type LayoutNode = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned: boolean;
  type: NodeType;
};

export type LayoutEdge = {
  source: string;
  target: string;
  weight: number;
};

export type LayoutOptions = {
  width: number;
  height: number;
  iterations?: number;
  seed?: number;
  repulsion?: number;
  springK?: number;
  idealLen?: number;
  damping?: number;
  centerPull?: number;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TYPE_ORDER: NodeType[] = [
  "index",
  "claude-md",
  "reference",
  "user",
  "feedback",
  "project",
  "skill",
  "plugin-skill",
  "command",
  "plugin-command",
  "agent",
  "plugin-agent",
  "rule",
  "hook",
  "plan",
  "output-style",
  "unknown",
];

export function initLayout(graph: MemoryGraph, opts: LayoutOptions): LayoutNode[] {
  const rand = mulberry32(opts.seed ?? 7);
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const maxR = Math.min(opts.width, opts.height) * 0.44;

  const byType = new Map<NodeType, string[]>();
  for (const n of graph.nodes) {
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type)!.push(n.id);
  }
  const presentTypes = TYPE_ORDER.filter((t) => byType.has(t) && t !== "index");
  const typeIndex = new Map<NodeType, number>();
  presentTypes.forEach((t, i) => typeIndex.set(t, i));
  const sectorCount = Math.max(1, presentTypes.length);

  const nodes: LayoutNode[] = graph.nodes.map((n) => {
    if (n.type === "index") {
      return { id: n.id, x: cx, y: cy, vx: 0, vy: 0, pinned: true, type: n.type };
    }
    const sector = typeIndex.get(n.type) ?? sectorCount - 1;
    const sectorAngle = (sector / sectorCount) * Math.PI * 2;
    const bucketIds = byType.get(n.type)!;
    const posInBucket = bucketIds.indexOf(n.id);
    const bucketSize = bucketIds.length;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const inner = maxR * 0.28;
    const ringStep = maxR * 0.55;
    const ringR = inner + ringStep * (posInBucket / Math.max(1, bucketSize));
    const spread = (2 * Math.PI) / sectorCount;
    const jitter = (rand() - 0.5) * spread * 0.9;
    const angle = sectorAngle + jitter + posInBucket * golden * 0.08;
    return {
      id: n.id,
      x: cx + Math.cos(angle) * ringR + (rand() - 0.5) * 20,
      y: cy + Math.sin(angle) * ringR + (rand() - 0.5) * 20,
      vx: 0,
      vy: 0,
      pinned: false,
      type: n.type,
    };
  });
  return nodes;
}

function autoIterations(n: number, requested?: number): number {
  if (requested !== undefined) return requested;
  if (n <= 40) return 220;
  if (n <= 150) return 160;
  if (n <= 400) return 100;
  if (n <= 800) return 60;
  return 40;
}

export type PhysicsState = {
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  pinned: Uint8Array;
  ids: string[];
};

export type PhysicsEdges = {
  si: Uint32Array;
  ti: Uint32Array;
  weight: Float32Array;
  count: number;
};

export function createPhysicsState(graph: MemoryGraph, opts: LayoutOptions): PhysicsState {
  const laid = initLayout(graph, opts);
  const n = laid.length;
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  const pinned = new Uint8Array(n);
  const ids: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = laid[i].x;
    y[i] = laid[i].y;
    pinned[i] = laid[i].pinned ? 1 : 0;
    ids[i] = laid[i].id;
  }
  return { x, y, vx, vy, pinned, ids };
}

export function createPhysicsEdges(graph: MemoryGraph, idIndex: Map<string, number>): PhysicsEdges {
  const m = graph.edges.length;
  const si = new Uint32Array(m);
  const ti = new Uint32Array(m);
  const weight = new Float32Array(m);
  let count = 0;
  for (const e of graph.edges) {
    const a = idIndex.get(e.source);
    const b = idIndex.get(e.target);
    if (a === undefined || b === undefined) continue;
    si[count] = a;
    ti[count] = b;
    weight[count] = e.weight;
    count++;
  }
  return { si, ti, weight, count };
}

export type PhysOpts = {
  width: number;
  height: number;
  repulsion?: number;
  springK?: number;
  idealLen?: number;
  damping?: number;
  centerPull?: number;
};

export function physicsStep(
  state: PhysicsState,
  edges: PhysicsEdges,
  opts: PhysOpts,
  draggedIdx: number = -1,
  draggedX: number = 0,
  draggedY: number = 0,
  alpha: number = 1,
): number {
  const { x, y, vx, vy, pinned } = state;
  const n = x.length;
  const repulsion = (opts.repulsion ?? 2200) * alpha;
  const springK = (opts.springK ?? 0.025) * alpha;
  const idealLen = opts.idealLen ?? 70;
  const damping = opts.damping ?? 0.75;
  const centerPull = (opts.centerPull ?? 0.006) * alpha;
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const cellSize = Math.max(40, idealLen * 1.4);

  if (draggedIdx >= 0 && draggedIdx < n) {
    x[draggedIdx] = draggedX;
    y[draggedIdx] = draggedY;
    vx[draggedIdx] = 0;
    vy[draggedIdx] = 0;
  }

  const grid = new Map<number, number[]>();
  const gridKey = (gx: number, gy: number) => gx * 73856093 ^ gy * 19349663;
  for (let i = 0; i < n; i++) {
    const k = gridKey(Math.floor(x[i] / cellSize), Math.floor(y[i] / cellSize));
    let bucket = grid.get(k);
    if (!bucket) {
      bucket = [];
      grid.set(k, bucket);
    }
    bucket.push(i);
  }

  const cell2 = cellSize * cellSize * 4;
  for (let i = 0; i < n; i++) {
    if (pinned[i] || i === draggedIdx) continue;
    let fx = 0;
    let fy = 0;
    const gx = Math.floor(x[i] / cellSize);
    const gy = Math.floor(y[i] / cellSize);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(gridKey(gx + dx, gy + dy));
        if (!bucket) continue;
        for (let b = 0; b < bucket.length; b++) {
          const j = bucket[b];
          if (i === j) continue;
          const ddx = x[i] - x[j];
          const ddy = y[i] - y[j];
          const distSq = ddx * ddx + ddy * ddy + 0.01;
          if (distSq > cell2) continue;
          const dist = Math.sqrt(distSq);
          const f = repulsion / distSq;
          fx += (ddx / dist) * f;
          fy += (ddy / dist) * f;
        }
      }
    }
    fx += (cx - x[i]) * centerPull;
    fy += (cy - y[i]) * centerPull;
    vx[i] = (vx[i] + fx) * damping;
    vy[i] = (vy[i] + fy) * damping;
  }

  for (let k = 0; k < edges.count; k++) {
    const a = edges.si[k];
    const b = edges.ti[k];
    const w = edges.weight[k];
    const ddx = x[b] - x[a];
    const ddy = y[b] - y[a];
    const dist = Math.sqrt(ddx * ddx + ddy * ddy) + 0.01;
    const force = (dist - idealLen) * springK * w;
    const fxs = (ddx / dist) * force;
    const fys = (ddy / dist) * force;
    if (!pinned[a] && a !== draggedIdx) {
      vx[a] += fxs;
      vy[a] += fys;
    }
    if (!pinned[b] && b !== draggedIdx) {
      vx[b] -= fxs;
      vy[b] -= fys;
    }
  }

  let energy = 0;
  const margin = 10;
  const maxX = opts.width - margin;
  const maxY = opts.height - margin;
  const vFloor = 0.01;
  for (let i = 0; i < n; i++) {
    if (pinned[i] || i === draggedIdx) continue;
    if (Math.abs(vx[i]) < vFloor) vx[i] = 0;
    if (Math.abs(vy[i]) < vFloor) vy[i] = 0;
    x[i] += vx[i];
    y[i] += vy[i];
    if (x[i] < margin) x[i] = margin;
    if (x[i] > maxX) x[i] = maxX;
    if (y[i] < margin) y[i] = margin;
    if (y[i] > maxY) y[i] = maxY;
    energy += vx[i] * vx[i] + vy[i] * vy[i];
  }
  return energy;
}

export function simulateLayout(graph: MemoryGraph, opts: LayoutOptions): LayoutNode[] {
  const n = graph.nodes.length;
  const iterations = autoIterations(n, opts.iterations);
  const densityScale = Math.max(0.6, Math.min(1.4, Math.sqrt(200 / Math.max(1, n))));
  const repulsion = opts.repulsion ?? 2800 * densityScale;
  const springK = opts.springK ?? 0.025;
  const idealLen = opts.idealLen ?? 90;
  const damping = opts.damping ?? 0.86;
  const centerPull = opts.centerPull ?? 0.006;
  const cx = opts.width / 2;
  const cy = opts.height / 2;
  const cellSize = Math.max(40, idealLen * 1.4);

  const nodes = initLayout(graph, opts);
  const idIndex = new Map(nodes.map((n, i) => [n.id, i]));

  for (let step = 0; step < iterations; step++) {
    const grid = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      const gx = Math.floor(a.x / cellSize);
      const gy = Math.floor(a.y / cellSize);
      const key = `${gx},${gy}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(i);
    }

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      if (a.pinned) continue;
      let fx = 0;
      let fy = 0;
      const gx = Math.floor(a.x / cellSize);
      const gy = Math.floor(a.y / cellSize);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const bucket = grid.get(`${gx + dx},${gy + dy}`);
          if (!bucket) continue;
          for (const j of bucket) {
            if (i === j) continue;
            const b = nodes[j];
            const ddx = a.x - b.x;
            const ddy = a.y - b.y;
            const distSq = ddx * ddx + ddy * ddy + 0.01;
            if (distSq > cellSize * cellSize * 4) continue;
            const dist = Math.sqrt(distSq);
            const force = repulsion / distSq;
            fx += (ddx / dist) * force;
            fy += (ddy / dist) * force;
          }
        }
      }

      fx += (cx - a.x) * centerPull;
      fy += (cy - a.y) * centerPull;

      a.vx = (a.vx + fx) * damping;
      a.vy = (a.vy + fy) * damping;
    }

    for (const e of graph.edges) {
      const i = idIndex.get(e.source);
      const j = idIndex.get(e.target);
      if (i === undefined || j === undefined) continue;
      const a = nodes[i];
      const b = nodes[j];
      const ddx = b.x - a.x;
      const ddy = b.y - a.y;
      const dist = Math.sqrt(ddx * ddx + ddy * ddy) + 0.01;
      const force = (dist - idealLen) * springK * e.weight;
      const fx = (ddx / dist) * force;
      const fy = (ddy / dist) * force;
      if (!a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    for (const m of nodes) {
      if (m.pinned) continue;
      m.x += m.vx;
      m.y += m.vy;
      const margin = 20;
      if (m.x < margin) m.x = margin;
      if (m.x > opts.width - margin) m.x = opts.width - margin;
      if (m.y < margin) m.y = margin;
      if (m.y > opts.height - margin) m.y = opts.height - margin;
    }
  }

  return nodes;
}
