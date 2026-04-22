import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const ScrollRack: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      <ellipse cx={x + 8} cy={y + 20} rx={9} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* frame */}
      <rect x={x} y={y} width="16" height="20" fill={C.woodDark} />
      <rect x={x + 1} y={y + 1} width="14" height="18" fill={C.woodMid} opacity="0.7" />
      {/* shelf dividers */}
      {[0, 7, 14].map((yi) => (
        <g key={`divider-${yi}`}>
          <line x1={x + 1} y1={y + yi} x2={x + 15} y2={y + yi} stroke={C.woodDark} strokeWidth="0.3" />
        </g>
      ))}
      {/* rolled scrolls (parchment cylinders) */}
      {[2, 9, 16].map((yi) => (
        <g key={`scroll-${yi}`}>
          <rect x={x + 2} y={y + yi} width="3" height="1.2" fill={C.parchment} />
          <rect x={x + 6} y={y + yi} width="3" height="1.2" fill={C.paperShade} />
          <rect x={x + 10} y={y + yi} width="3" height="1.2" fill={color} opacity="0.6" />
          {/* ties */}
          <rect x={x + 2} y={y + yi + 1.2} width="0.5" height="0.3" fill={C.inkDark} opacity="0.4" />
          <rect x={x + 6} y={y + yi + 1.2} width="0.5" height="0.3" fill={C.inkDark} opacity="0.4" />
          <rect x={x + 10} y={y + yi + 1.2} width="0.5" height="0.3" fill={C.inkDark} opacity="0.4" />
        </g>
      ))}
    </g>
  );
};

registerObject("ScrollRack", ScrollRack);
