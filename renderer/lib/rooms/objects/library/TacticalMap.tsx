import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const TacticalMap: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width="40" height="24" fill={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="38" height="22" fill={C.parchment} />
      <rect x={x + 1} y={y + 1} width="38" height="2" fill={C.paperShade} />
      {/* grid lines */}
      {[12, 20, 28, 36].map((xi) => (
        <rect key={`gx-${xi}`} x={x + xi} y={y + 3} width="0.2" height="20" fill={C.inkDark} opacity="0.2" />
      ))}
      {[8, 14, 20].map((yi) => (
        <rect key={`gy-${yi}`} x={x + 2} y={y + yi} width="36" height="0.2" fill={C.inkDark} opacity="0.2" />
      ))}
      {/* landmass shapes */}
      <path d={`M ${x + 6} ${y + 8} L ${x + 14} ${y + 6} L ${x + 18} ${y + 10} L ${x + 16} ${y + 16} L ${x + 10} ${y + 18} Z`} fill={C.grassDark} />
      <path d={`M ${x + 22} ${y + 9} L ${x + 32} ${y + 7} L ${x + 36} ${y + 14} L ${x + 32} ${y + 20} Z`} fill={C.hill} />
      {/* cursor pin */}
      <g>
        <rect x={x + 12} y={y + 13} width="0.3" height="3" fill={C.woodOutline} />
        <circle cx={x + 12} cy={y + 11} r="1.5" fill={color} />
        <circle cx={x + 12} cy={y + 11} r="0.7" fill="#fff" opacity="0.6" />
      </g>
      {/* route marker */}
      <g>
        <rect x={x + 26} y={y + 15} width="0.3" height="3" fill={C.woodOutline} />
        <circle cx={x + 26} cy={y + 13} r="1.5" fill={C.redAccent} />
      </g>
      {/* compass rose corner */}
      <circle cx={x + 35} cy={y + 20} r="2.5" fill="none" stroke={C.inkDark} strokeWidth="0.2" />
      <line x1={x + 35} y1={y + 17.5} x2={x + 35} y2={y + 22.5} stroke={C.inkDark} strokeWidth="0.2" />
      <line x1={x + 32.5} y1={y + 20} x2={x + 37.5} y2={y + 20} stroke={C.inkDark} strokeWidth="0.2" />
    </g>
  );
};

registerObject("TacticalMap", TacticalMap);
