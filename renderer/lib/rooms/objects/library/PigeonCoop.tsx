import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const PigeonCoop: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 10} cy={y + 16} rx="8" ry="1.5" fill={C.shadow} opacity="0.3" />

      {/* wooden coop box */}
      <rect x={x + 1} y={y + 2} width="18" height="14" fill={C.woodMid} />
      <rect x={x + 1} y={y + 2} width="18" height="14" fill={C.woodLight} opacity="0.3" />

      {/* wood planks */}
      <line x1={x + 1} y1={y + 5} x2={x + 19} y2={y + 5} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.5" />
      <line x1={x + 1} y1={y + 9} x2={x + 19} y2={y + 9} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.5" />
      <line x1={x + 1} y1={y + 13} x2={x + 19} y2={y + 13} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.5" />

      {/* entry holes (3 circular openings) */}
      <circle cx={x + 5} cy={y + 7} r="2" fill={C.woodOutline} />
      <circle cx={x + 5} cy={y + 7} r="1.5" fill={C.shadow} opacity="0.5" />

      <circle cx={x + 10} cy={y + 7} r="2" fill={C.woodOutline} />
      <circle cx={x + 10} cy={y + 7} r="1.5" fill={C.shadow} opacity="0.5" />

      <circle cx={x + 15} cy={y + 7} r="2" fill={C.woodOutline} />
      <circle cx={x + 15} cy={y + 7} r="1.5" fill={C.shadow} opacity="0.5" />

      {/* pigeon sticking out (right side hole) */}
      <ellipse cx={x + 17} cy={y + 6} rx="2" ry="1.8" fill={C.catGray} />
      <circle cx={x + 18} cy={y + 5} r="1" fill={C.catGray} />
      {/* eye */}
      <circle cx={x + 18.6} cy={y + 4.7} r="0.4" fill={C.eyeGold} />
      {/* beak */}
      <polygon points={`${x + 19},${y + 5} ${x + 20},${y + 5} ${x + 19.5},${y + 4.8}`} fill={C.goldDark} />

      {/* roost bars inside */}
      <line x1={x + 2} y1={y + 11} x2={x + 18} y2={y + 11} stroke={C.woodOutline} strokeWidth="0.4" opacity="0.6" />
      <line x1={x + 2} y1={y + 13.5} x2={x + 18} y2={y + 13.5} stroke={C.woodOutline} strokeWidth="0.4" opacity="0.6" />

      {/* frame edges */}
      <rect x={x + 1} y={y + 2} width="18" height="14" fill="none" stroke={C.woodOutline} strokeWidth="1" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="20" height="16" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 2} width="18" height="14" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("PigeonCoop", PigeonCoop);
