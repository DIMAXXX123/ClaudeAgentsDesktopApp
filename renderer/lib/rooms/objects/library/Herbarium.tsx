import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Herbarium: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      <ellipse cx={x + 9} cy={y + 14} rx={10} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* glass case frame */}
      <rect x={x} y={y} width="18" height="14" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="16" height="12" fill={C.steelMid} opacity="0.3" />
      {/* glass pane shine */}
      <rect x={x + 1} y={y + 1} width="16" height="1" fill="#fff" opacity="0.15" />
      {/* specimen pins and leaves */}
      <g>
        {/* leaf 1 */}
        <line x1={x + 4} y1={y + 4} x2={x + 7} y2={y + 9} stroke={C.metalDark} strokeWidth="0.2" />
        <path d={`M ${x + 7} ${y + 9} Q ${x + 8} ${y + 6} ${x + 9} ${y + 5}`} stroke={C.leaves} strokeWidth="1" fill="none" />
        {/* leaf 2 */}
        <line x1={x + 10} y1={y + 3} x2={x + 12} y2={y + 8} stroke={C.metalDark} strokeWidth="0.2" />
        <path d={`M ${x + 12} ${y + 8} Q ${x + 13} ${y + 5} ${x + 14} ${y + 4}`} stroke={C.leavesDark} strokeWidth="1" fill="none" />
        {/* leaf 3 */}
        <line x1={x + 6} y1={y + 11} x2={x + 8} y2={y + 7} stroke={C.metalDark} strokeWidth="0.2" />
        <path d={`M ${x + 8} ${y + 7} Q ${x + 7} ${y + 10} ${x + 6} ${y + 11}`} stroke={C.leaves} strokeWidth="1" fill="none" />
        {/* label */}
        <rect x={x + 2} y={y + 11} width="8" height="1.5" fill={C.paper} />
        <line x1={x + 3} y1={y + 11.3} x2={x + 9} y2={y + 11.3} stroke={C.inkDark} strokeWidth="0.1" />
      </g>
      {/* wood base */}
      <rect x={x - 1} y={y + 13} width="20" height="1" fill={C.woodMid} />
    </g>
  );
};

registerObject("Herbarium", Herbarium);
