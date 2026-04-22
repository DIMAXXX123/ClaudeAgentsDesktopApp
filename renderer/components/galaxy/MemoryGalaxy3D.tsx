"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Html } from "@react-three/drei";
import { Vector3, BufferGeometry, LineBasicMaterial, BufferAttribute, Line as ThreeLine } from "three";
import type { MemoryEdge, MemoryNode } from "@/lib/memoryGalaxy";
import { NODE_COLOR } from "@/lib/memoryGalaxy";

type Props = {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  onSelectNode: (id: string) => void;
  selectedId?: string;
};

type LayoutNode = {
  id: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

const FORCE_STRENGTH = 0.5;
const DAMPING = 0.95;
const MIN_DISTANCE = 3;
const MAX_ITERATIONS = 100;

function fruchtermanReingold3D(
  nodes: MemoryNode[],
  edges: MemoryEdge[],
  iterations: number = MAX_ITERATIONS,
): LayoutNode[] {
  const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const radius = 20 + Math.random() * 10;
    return {
      id: n.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      z: (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
      vz: 0,
    };
  });

  const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 100 / (iter + 1);

    layoutNodes.forEach((a) => {
      layoutNodes.forEach((b) => {
        if (a.id === b.id) return;

        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dz = b.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;
        const minDist = Math.max(MIN_DISTANCE, 0.1);

        if (dist > 0.01) {
          const repulsion = (FORCE_STRENGTH * 100) / (dist * dist);
          a.vx -= (dx / dist) * repulsion;
          a.vy -= (dy / dist) * repulsion;
          a.vz -= (dz / dist) * repulsion;
        }
      });

      edges.forEach((e) => {
        const isSource = e.source === a.id;
        const isTarget = e.target === a.id;
        if (!isSource && !isTarget) return;

        const other = isSource ? nodeMap.get(e.target) : nodeMap.get(e.source);
        if (!other) return;

        const dx = other.x - a.x;
        const dy = other.y - a.y;
        const dz = other.z - a.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.1;

        const restLength = 30;
        const spring = (dist - restLength) * e.weight * 0.1;
        a.vx += (dx / dist) * spring;
        a.vy += (dy / dist) * spring;
        a.vz += (dz / dist) * spring;
      });

      a.vx *= DAMPING;
      a.vy *= DAMPING;
      a.vz *= DAMPING;

      a.x += a.vx;
      a.y += a.vy;
      a.z += a.vz;
    });
  }

  return layoutNodes;
}

type NodeSphereProps = {
  node: MemoryNode;
  position: [number, number, number];
  isSelected: boolean;
  onSelect: () => void;
};

function NodeSphere({ node, position, isSelected, onSelect }: NodeSphereProps) {
  const meshRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (!meshRef.current) return;
    const target = hovered || isSelected ? 1.5 : 1;
    meshRef.current.scale.lerp(new Vector3(target, target, target), 0.1);
  });

  const color = NODE_COLOR[node.type];

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
        onClick={onSelect}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshPhongMaterial color={color} emissive={hovered || isSelected ? color : "#000000"} />
      </mesh>
      {(hovered || isSelected) && (
        <Html position={[0, 1.5, 0]} center>
          <div
            style={{
              background: "rgba(0, 0, 0, 0.85)",
              color: "white",
              padding: "4px 8px",
              borderRadius: "4px",
              fontSize: "11px",
              maxWidth: "120px",
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontFamily: "monospace",
              border: `1px solid ${color}`,
            }}
          >
            {node.name}
          </div>
        </Html>
      )}
    </group>
  );
}

type EdgesProps = {
  layoutNodes: LayoutNode[];
  edges: MemoryEdge[];
};

function Edges({ layoutNodes, edges }: EdgesProps) {
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const lines: ThreeLine[] = [];

    edges.forEach((edge) => {
      const source = layoutNodes.find((n) => n.id === edge.source);
      const target = layoutNodes.find((n) => n.id === edge.target);
      if (!source || !target) return;

      const geometry = new BufferGeometry();
      const positions = new Float32Array([source.x, source.y, source.z, target.x, target.y, target.z]);
      geometry.setAttribute("position", new BufferAttribute(positions, 3));

      const material = new LineBasicMaterial({
        color: "#444444",
        transparent: true,
        opacity: 0.3,
      });

      const line = new ThreeLine(geometry, material);
      line.name = `edge-${edge.source}-${edge.target}`;
      scene.add(line);
      lines.push(line);
    });

    return () => {
      lines.forEach((line) => {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as any).dispose?.();
      });
    };
  }, [layoutNodes, edges, scene]);

  return null;
}

export function MemoryGalaxy3D({ nodes, edges, onSelectNode, selectedId }: Props) {
  const layoutNodes = useMemo(
    () => fruchtermanReingold3D(nodes, edges, Math.min(MAX_ITERATIONS, nodes.length)),
    [nodes, edges],
  );

  const nodeMap = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <Canvas camera={{ position: [0, 0, 60], fov: 60 }}>
        <ambientLight intensity={0.6} />
        <pointLight position={[30, 30, 30]} intensity={0.8} />
        <pointLight position={[-30, -30, -30]} intensity={0.4} />

        <Stars radius={300} depth={60} count={5000} />

        <Edges layoutNodes={layoutNodes} edges={edges} />

        {layoutNodes.map((layoutNode) => {
          const node = nodeMap.get(layoutNode.id);
          if (!node) return null;
          return (
            <NodeSphere
              key={node.id}
              node={node}
              position={[layoutNode.x, layoutNode.y, layoutNode.z]}
              isSelected={selectedId === node.id}
              onSelect={() => onSelectNode(node.id)}
            />
          );
        })}

        <OrbitControls
          autoRotate={false}
          autoRotateSpeed={2}
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
        />
      </Canvas>
    </div>
  );
}
