import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const FlameSword: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* mounting bracket */}
      <rect x={x + 2} y={y + 1} width="4" height="3" fill={C.metalDark} />
      <circle cx={x + 3.5} cy={y + 3} r="0.5" fill={C.metalShine} />
      <circle cx={x + 5} cy={y + 3} r="0.5" fill={C.metalShine} />

      {/* blade (flat grey) */}
      <rect x={x + 3} y={y + 4} width="1.5" height="18" fill={C.steelMid} />
      <rect x={x + 3} y={y + 4} width="1.5" height="18" fill={C.steelLight} opacity="0.4" />

      {/* blade edge highlight */}
      <line x1={x + 3} y1={y + 4} x2={x + 3} y2={y + 22} stroke={C.metalHi} strokeWidth="0.3" />

      {/* crossguard */}
      <rect x={x + 1} y={y + 21} width="5" height="0.8" fill={C.goldDark} />
      <circle cx={x + 1.5} cy={y + 21.4} r="0.5" fill={C.goldHi} />
      <circle cx={x + 3.5} cy={y + 21.4} r="0.5" fill={C.goldHi} />
      <circle cx={x + 5.5} cy={y + 21.4} r="0.5" fill={C.goldHi} />

      {/* hilt/grip */}
      <rect x={x + 2.5} y={y + 21.8} width="2" height="0.8" fill={C.woodMid} />

      {/* flame effect when working */}
      {working && (
        <>
          <polygon points={`${x + 3.5},${y + 5} ${x + 5},${y + 8} ${x + 4},${y + 8} ${x + 4.5},${y + 5}`} fill={C.fireHot} className="anim-spark-fly" />
          <polygon points={`${x + 3.5},${y + 10} ${x + 5.2},${y + 14} ${x + 4},${y + 14} ${x + 4.5},${y + 10}`} fill={C.fireMid} className="anim-spark-fly" />
          <polygon points={`${x + 3.5},${y + 16} ${x + 5},${y + 19} ${x + 4},${y + 19} ${x + 4.5},${y + 16}`} fill={C.fireLow} className="anim-spark-fly" />
        </>
      )}

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="8" height="22" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 3} width="4" height="20" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("FlameSword", FlameSword);
