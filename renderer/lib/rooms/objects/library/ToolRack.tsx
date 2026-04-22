import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const ToolRack: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width="18" height="24" fill={C.woodDark} />
      <rect x={x + 1} y={y + 1} width="16" height="22" fill={C.woodMid} opacity="0.7" />
      {/* horizontal support bars */}
      {[6, 12, 18].map((yi) => (
        <rect key={`bar-${yi}`} x={x + 1} y={y + yi} width="16" height="0.5" fill={C.woodLight} />
      ))}
      {/* hammer silhouette */}
      <g>
        <rect x={x + 2} y={y + 3} width="0.8" height="4" fill={C.metalDark} />
        <rect x={x + 1.5} y={y + 2} width="1.8" height="1" fill={C.metalMid} />
      </g>
      {/* wrench silhouette */}
      <g>
        <ellipse cx={x + 7} cy={y + 4} rx={2.5} ry={0.7} fill={C.metalDark} />
        <rect x={x + 8.5} y={y + 3.5} width="2" height="1" fill={C.metalDark} />
      </g>
      {/* saw silhouette */}
      <g>
        <line x1={x + 13} y1={y + 2} x2={x + 16} y2={y + 5} stroke={C.metalDark} strokeWidth="0.5" />
        <line x1={x + 13} y1={y + 2.4} x2={x + 16} y2={y + 5.4} stroke={C.metalDark} strokeWidth="0.3" />
      </g>
      {/* screwdriver */}
      <g>
        <rect x={x + 3} y={y + 10} width="0.5" height="3" fill={C.metalMid} />
        <rect x={x + 2.8} y={y + 12.5} width="0.9" height="0.8" fill={C.woodMid} />
      </g>
      {/* pliers */}
      <g>
        <circle cx={x + 7} cy={y + 11} r="0.8" fill={C.metalDark} />
        <line x1={x + 6} y1={y + 11} x2={x + 5} y2={y + 13} stroke={C.metalDark} strokeWidth="0.4" />
        <line x1={x + 8} y1={y + 11} x2={x + 9} y2={y + 13} stroke={C.metalDark} strokeWidth="0.4" />
      </g>
      {/* axe */}
      <g>
        <rect x={x + 13} y={y + 11} width="0.6" height="3" fill={C.metalDark} />
        <polygon points={`${x + 13.3},${y + 10.5} ${x + 15},${y + 10} ${x + 15},${y + 11}`} fill={C.metalDark} />
      </g>
    </g>
  );
};

registerObject("ToolRack", ToolRack);
