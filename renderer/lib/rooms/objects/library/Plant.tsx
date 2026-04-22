import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Plant: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 6} cy={y + 14} rx={4} ry={1.2} fill={C.shadow} opacity="0.3" />

      {/* pot */}
      <ellipse cx={x + 6} cy={y + 12} rx={4.5} ry={1.5} fill={C.pot} />
      <rect x={x + 2.5} y={y + 6} width="7" height="6" fill={C.potDark} />
      <rect x={x + 2.8} y={y + 6.3} width="6.4" height="5.4" fill={C.pot} opacity="0.7" />

      {/* pot rim */}
      <ellipse cx={x + 6} cy={y + 6} rx={4.2} ry={0.8} fill={C.potDark} />

      {/* soil */}
      <ellipse cx={x + 6} cy={y + 6.5} rx={3.8} ry={0.6} fill={C.woodOutline} opacity="0.6" />

      {/* leaf 1 (left) */}
      <path d={`M ${x + 4} ${y + 6} Q ${x + 2} ${y + 3} ${x + 3} ${y + 1}`} stroke={C.leaves} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d={`M ${x + 4} ${y + 6} Q ${x + 2.5} ${y + 2.5} ${x + 3.5} ${y + 0.5}`} stroke={C.leavesDark} strokeWidth="0.5" fill="none" opacity="0.6" strokeLinecap="round" />

      {/* leaf 2 (right) */}
      <path d={`M ${x + 8} ${y + 6} Q ${x + 10} ${y + 2} ${x + 9} ${y + 0.5}`} stroke={C.leaves} strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d={`M ${x + 8} ${y + 6} Q ${x + 9.5} ${y + 1.5} ${x + 8.5} ${y + 0}`} stroke={C.leavesDark} strokeWidth="0.5" fill="none" opacity="0.6" strokeLinecap="round" />

      {/* leaf 3 (center) */}
      <path d={`M ${x + 6} ${y + 6.5} Q ${x + 6} ${y + 2} ${x + 6.5} ${y + 0}`} stroke={C.leaves} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d={`M ${x + 6} ${y + 6.5} Q ${x + 5.5} ${y + 2.5} ${x + 5.5} ${y + 0.5}`} stroke={C.leavesDark} strokeWidth="0.6" fill="none" opacity="0.6" strokeLinecap="round" />

      {/* error indicator */}
      {errored && (
        <rect x={x + 1} y={y} width="10" height="14" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <ellipse cx={x + 6} cy={y + 5} rx={5.5} ry={6} fill="none" stroke={C.leaves} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("Plant", Plant);
