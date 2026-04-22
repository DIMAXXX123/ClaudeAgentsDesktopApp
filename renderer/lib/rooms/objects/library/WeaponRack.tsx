import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const WeaponRack: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* wall mount */}
      <rect x={x + 1} y={y} width="16" height="2" fill={C.woodDark} />
      <rect x={x} y={y + 1} width="18" height="1" fill={C.woodMid} />

      {/* frame */}
      <rect x={x + 2} y={y + 2} width="14" height="22" fill={C.woodOutline} />
      <rect x={x + 3} y={y + 3} width="12" height="20" fill={C.woodMid} opacity="0.6" />

      {/* swords (3 diagonal) */}
      <line x1={x + 5} y1={y + 5} x2={x + 9} y2={y + 18} stroke={C.metalHi} strokeWidth="1" strokeLinecap="round" />
      <line x1={x + 7} y1={y + 4} x2={x + 11} y2={y + 20} stroke={C.metalMid} strokeWidth="1" strokeLinecap="round" />
      <line x1={x + 9} y1={y + 5} x2={x + 13} y2={y + 19} stroke={C.metalLight} strokeWidth="1" strokeLinecap="round" />

      {/* axe (right side) */}
      <rect x={x + 12} y={y + 8} width="2" height="10" fill={C.metalDark} />
      <polygon points={`${x + 11},${y + 8} ${x + 15},${y + 8} ${x + 14},${y + 6} ${x + 12},${y + 6}`} fill={C.fireHot} />

      {/* pegs */}
      <circle cx={x + 5} cy={y + 22} r="0.8" fill={C.woodLight} />
      <circle cx={x + 10} cy={y + 22} r="0.8" fill={C.woodLight} />
      <circle cx={x + 15} cy={y + 22} r="0.8" fill={C.woodLight} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="18" height="26" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 2} width="14" height="22" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("WeaponRack", WeaponRack);
