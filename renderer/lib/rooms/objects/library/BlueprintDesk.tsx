import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BlueprintDesk: ObjectComponent = ({ x, y, color, active }) => {
  return (
    <g>
      <ellipse cx={x + 12} cy={y + 14} rx={14} ry={2} fill={C.shadow} opacity="0.35" />
      {/* desk surface */}
      <rect x={x} y={y + 12} width="24" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 12} width="24" height="1" fill={C.woodLight} opacity="0.5" />
      {/* legs */}
      <rect x={x + 2} y={y + 14} width="2" height="6" fill={C.woodDark} />
      <rect x={x + 20} y={y + 14} width="2" height="6" fill={C.woodDark} />
      {/* drafting surface - blue paper */}
      <rect x={x + 2} y={y + 4} width="20" height="8" fill={C.steelMid} opacity="0.6" />
      <rect x={x + 2} y={y + 4} width="20" height="8" fill="#1a4a8a" opacity="0.8" />
      {/* grid lines */}
      {[6, 8, 10].map((xi) => (
        <line key={`vg-${xi}`} x1={x + xi} y1={y + 4} x2={x + xi} y2={y + 12} stroke="#fff" strokeWidth="0.1" opacity="0.3" />
      ))}
      {[5, 7, 9, 11].map((yi) => (
        <line key={`hg-${yi}`} x1={x + 2} y1={y + yi} x2={x + 22} y2={y + yi} stroke="#fff" strokeWidth="0.1" opacity="0.3" />
      ))}
      {/* blueprint sketch lines (white) */}
      <line x1={x + 4} y1={y + 6} x2={x + 12} y2={y + 6} stroke="#fff" strokeWidth="0.3" opacity="0.8" />
      <line x1={x + 4} y1={y + 7} x2={x + 10} y2={y + 7} stroke="#fff" strokeWidth="0.2" opacity="0.7" />
      <line x1={x + 4} y1={y + 8} x2={x + 14} y2={y + 8} stroke="#fff" strokeWidth="0.3" opacity="0.8" />
      <line x1={x + 4} y1={y + 10} x2={x + 10} y2={y + 10} stroke="#fff" strokeWidth="0.2" opacity="0.7" />
      {/* dimension lines */}
      <line x1={x + 14} y1={y + 5.5} x2={x + 14} y2={y + 10.5} stroke={color} strokeWidth="0.2" opacity="0.6" />
      <line x1={x + 13} y1={y + 5.5} x2={x + 15} y2={y + 5.5} stroke={color} strokeWidth="0.2" opacity="0.6" />
      <line x1={x + 13} y1={y + 10.5} x2={x + 15} y2={y + 10.5} stroke={color} strokeWidth="0.2" opacity="0.6" />
      {/* rolled tubes at bottom right */}
      <g>
        <rect x={x + 16} y={y + 4} width="2" height="1" fill={C.paper} />
        <rect x={x + 18} y={y + 4.5} width="2" height="1" fill={color} opacity="0.5" />
      </g>
      {/* measuring tool (compass) on side */}
      {active && (
        <circle cx={x + 20} cy={y + 8} r="1.5" fill="none" stroke={color} strokeWidth="0.2" opacity="0.7" />
      )}
    </g>
  );
};

registerObject("BlueprintDesk", BlueprintDesk);
