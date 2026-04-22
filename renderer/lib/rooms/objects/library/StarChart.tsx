import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const StarChart: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width="20" height="16" fill={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="18" height="14" fill={C.crtBg} />
      {/* constellation stars */}
      <circle cx={x + 4} cy={y + 3} r="0.5" fill={C.goldHi} />
      <circle cx={x + 8} cy={y + 2} r="0.5" fill={C.goldHi} />
      <circle cx={x + 12} cy={y + 4} r="0.5" fill={C.goldHi} />
      <circle cx={x + 16} cy={y + 3} r="0.5" fill={C.goldHi} />
      <circle cx={x + 5} cy={y + 8} r="0.5" fill={C.goldHi} />
      <circle cx={x + 10} cy={y + 9} r="0.5" fill={C.goldHi} />
      <circle cx={x + 14} cy={y + 8} r="0.5" fill={C.goldHi} />
      <circle cx={x + 3} cy={y + 13} r="0.5" fill={C.goldHi} />
      <circle cx={x + 9} cy={y + 14} r="0.5" fill={C.goldHi} />
      <circle cx={x + 17} cy={y + 12} r="0.5" fill={C.goldHi} />
      {/* constellations (lines) */}
      <line x1={x + 4} y1={y + 3} x2={x + 8} y2={y + 2} stroke={C.goldDark} strokeWidth="0.2" opacity="0.6" />
      <line x1={x + 8} y1={y + 2} x2={x + 12} y2={y + 4} stroke={C.goldDark} strokeWidth="0.2" opacity="0.6" />
      <line x1={x + 5} y1={y + 8} x2={x + 10} y2={y + 9} stroke={C.goldDark} strokeWidth="0.2" opacity="0.6" />
      <line x1={x + 10} y1={y + 9} x2={x + 14} y2={y + 8} stroke={C.goldDark} strokeWidth="0.2" opacity="0.6" />
      {/* highlight marker */}
      <circle cx={x + 10} cy={y + 9} r="1.5" fill="none" stroke={color} strokeWidth="0.3" opacity="0.7" />
    </g>
  );
};

registerObject("StarChart", StarChart);
