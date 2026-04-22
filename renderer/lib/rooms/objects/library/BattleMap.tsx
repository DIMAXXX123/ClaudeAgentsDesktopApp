import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BattleMap: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width="36" height="22" fill={C.woodOutline} />
      <rect x={x + 2} y={y + 2} width="32" height="18" fill={C.parchment} />

      {/* map background grid */}
      <line x1={x + 6} y1={y + 4} x2={x + 6} y2={y + 18} stroke={C.paperShade} strokeWidth="0.5" opacity="0.4" />
      <line x1={x + 12} y1={y + 4} x2={x + 12} y2={y + 18} stroke={C.paperShade} strokeWidth="0.5" opacity="0.4" />
      <line x1={x + 18} y1={y + 4} x2={x + 18} y2={y + 18} stroke={C.paperShade} strokeWidth="0.5" opacity="0.4" />
      <line x1={x + 24} y1={y + 4} x2={x + 24} y2={y + 18} stroke={C.paperShade} strokeWidth="0.5" opacity="0.4" />
      <line x1={x + 30} y1={y + 4} x2={x + 30} y2={y + 18} stroke={C.paperShade} strokeWidth="0.5" opacity="0.4" />

      {/* red tactical markers */}
      <circle cx={x + 10} cy={y + 8} r="1" fill={C.redAccent} />
      <circle cx={x + 16} cy={y + 10} r="0.8" fill={C.redAccent} />
      <circle cx={x + 22} cy={y + 12} r="0.9" fill={C.redAccent} />
      <circle cx={x + 28} cy={y + 6} r="0.7" fill={C.redAccent} />

      {/* arrows showing movement */}
      <path d={`M ${x + 10} ${y + 10} L ${x + 12} ${y + 12}`} stroke={C.redMid} strokeWidth="0.8" fill="none" markerEnd="url(#arrowHead)" />
      <path d={`M ${x + 16} ${y + 12} L ${x + 18} ${y + 14}`} stroke={C.redMid} strokeWidth="0.8" fill="none" markerEnd="url(#arrowHead)" />

      {/* legend boxes */}
      <rect x={x + 4} y={y + 16} width="2" height="2" fill={C.redAccent} />
      <text x={x + 7} y={y + 17.5} fontSize="1.5" fontFamily="monospace" fill={C.inkDark}>
        Enemy
      </text>

      {/* frame border */}
      <rect x={x} y={y} width="36" height="22" fill="none" stroke={C.woodDark} strokeWidth="2" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="36" height="22" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 2} width="32" height="18" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("BattleMap", BattleMap);
