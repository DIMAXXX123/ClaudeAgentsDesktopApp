import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const HoloTable: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 12} cy={y + 10} rx={14} ry={2} fill={C.shadow} opacity="0.35" />
      {/* pedestal base */}
      <rect x={x + 8} y={y + 8} width="8" height="2" fill={C.metalDark} />
      <rect x={x + 6} y={y + 10} width="12" height="1" fill={C.metalBlack} />
      {/* table surface */}
      <rect x={x + 2} y={y + 3} width="20" height="5" fill={C.metalMid} />
      <rect x={x + 2} y={y + 3} width="20" height="1" fill={C.metalLight} opacity="0.4" />
      {/* hologram projection (only when working) */}
      {working && (
        <g opacity="0.7">
          {/* pyramid shape */}
          <polygon points={`${x + 12},${y + 1} ${x + 8},${y + 4} ${x + 16},${y + 4}`} fill={color} />
          <polygon points={`${x + 12},${y + 1} ${x + 16},${y + 4} ${x + 12},${y + 6}`} fill={color} opacity="0.6" />
          <polygon points={`${x + 12},${y + 1} ${x + 12},${y + 6} ${x + 8},${y + 4}`} fill={color} opacity="0.5" />
          {/* glow lines */}
          <line x1={x + 8} y1={y + 4} x2={x + 16} y2={y + 4} stroke={color} strokeWidth="0.2" opacity="0.8" />
          <line x1={x + 12} y1={y + 1} x2={x + 12} y2={y + 6} stroke={color} strokeWidth="0.2" opacity="0.8" />
        </g>
      )}
      {/* off-state grid */}
      {!working && (
        <rect x={x + 6} y={y + 2} width="12" height="2" fill={color} opacity="0.2" />
      )}
    </g>
  );
};

registerObject("HoloTable", HoloTable);
