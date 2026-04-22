import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const JeweledChest: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 8} cy={y + 12} rx={6} ry={1.5} fill={C.shadow} opacity="0.35" />

      {/* chest base */}
      <rect x={x + 1} y={y + 5} width="14" height="6" fill={C.woodMid} />
      <rect x={x + 1} y={y + 5} width="14" height="6" fill={C.woodLight} opacity="0.3" />

      {/* chest lid (top dome) */}
      <path d={`M ${x + 1} ${y + 5} Q ${x + 8} ${y + 1} ${x + 15} ${y + 5}`} fill={C.woodDark} stroke={C.woodOutline} strokeWidth="0.5" />

      {/* metal bands */}
      <rect x={x + 2} y={y + 2.5} width="12" height="0.6" fill={C.metalMid} />
      <rect x={x + 2} y={y + 8} width="12" height="0.6" fill={C.metalMid} opacity="0.7" />

      {/* lock plate (center) */}
      <rect x={x + 7} y={y + 6} width="2" height="1.5" fill={C.metalDark} />
      <circle cx={x + 8} cy={y + 6.75} r="0.4" fill={C.goldDark} />

      {/* jewels (gems sticking out) */}
      <polygon points={`${x + 3},${y + 3} ${x + 3.5},${y + 2.5} ${x + 4},${y + 3}`} fill={C.fireHot} />
      <polygon points={`${x + 6},${y + 2} ${x + 6.5},${y + 1.5} ${x + 7},${y + 2}`} fill={C.redAccent} />
      <polygon points={`${x + 10},${y + 2.2} ${x + 10.5},${y + 1.7} ${x + 11},${y + 2.2}`} fill={C.fireHot} />
      <polygon points={`${x + 13},${y + 3} ${x + 13.5},${y + 2.5} ${x + 14},${y + 3}`} fill={C.redAccent} />

      {/* corner studs */}
      <circle cx={x + 2} cy={y + 5.5} r="0.5" fill={C.metalMid} />
      <circle cx={x + 14} cy={y + 5.5} r="0.5" fill={C.metalMid} />
      <circle cx={x + 2} cy={y + 10} r="0.5" fill={C.metalMid} />
      <circle cx={x + 14} cy={y + 10} r="0.5" fill={C.metalMid} />

      {/* handle (top) */}
      <path d={`M ${x + 5} ${y + 4.5} Q ${x + 8} ${y + 2} ${x + 11} ${y + 4.5}`} stroke={C.metalDark} strokeWidth="1" fill="none" />
      <circle cx={x + 5} cy={y + 4.5} r="0.4" fill={C.metalShine} />
      <circle cx={x + 11} cy={y + 4.5} r="0.4" fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="12" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <ellipse cx={x + 8} cy={y + 5} rx={7.5} ry={5.5} fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("JeweledChest", JeweledChest);
