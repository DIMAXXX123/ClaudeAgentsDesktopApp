import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const InkwellQuill: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      <ellipse cx={x + 3} cy={y + 8} rx={4} ry={1} fill={C.shadow} opacity="0.35" />
      {/* inkwell ceramic pot */}
      <circle cx={x + 2} cy={y + 5.5} r="2" fill={C.metalDark} />
      <circle cx={x + 2} cy={y + 5} r="1.8" fill={C.pot} />
      {/* ink inside */}
      <ellipse cx={x + 2} cy={y + 5} rx={1.5} ry={0.8} fill={C.inkDark} />
      {/* rim shine */}
      <ellipse cx={x + 2} cy={y + 4} rx={1.8} ry={0.3} fill={C.potDark} opacity="0.6" />
      {/* quill feather */}
      <line x1={x + 4} y1={y + 6} x2={x + 5} y2={y + 1} stroke={C.bone} strokeWidth="0.5" />
      <line x1={x + 4.1} y1={y + 6} x2={x + 4.8} y2={y + 1.5} stroke={C.bone} strokeWidth="0.3" opacity="0.6" />
      {/* feather barbs (left) */}
      {[1, 2, 3, 4].map((offset) => (
        <line key={`l-${offset}`} x1={x + 4 + offset * 0.15} y1={y + 6 - offset} x2={x + 3.3 + offset * 0.1} y2={y + 6.2 - offset} stroke={C.bone} strokeWidth="0.2" opacity="0.5" />
      ))}
      {/* gold nib */}
      <rect x={x + 4.8} y={y + 1} width="0.6" height="0.8" fill={C.gold} />
      <rect x={x + 4.9} y={y + 1.3} width="0.2" height="0.3" fill={C.goldHi} opacity="0.7" />
    </g>
  );
};

registerObject("InkwellQuill", InkwellQuill);
