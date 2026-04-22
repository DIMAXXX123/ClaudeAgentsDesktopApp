import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Cat: ObjectComponent = ({ x, y, extra, errored, active }) => {
  const catColor = (extra?.color as string) || C.catGray;

  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 7} cy={y + 8} rx={5} ry={1.2} fill={C.shadow} opacity="0.3" />

      {/* body */}
      <ellipse cx={x + 7} cy={y + 5} rx={4} ry={2.5} fill={catColor} />

      {/* legs */}
      <rect x={x + 4} y={y + 6.5} width="0.8" height="1.8" fill={catColor} />
      <rect x={x + 6.5} y={y + 6.5} width="0.8" height="1.8" fill={catColor} />
      <rect x={x + 8} y={y + 6.5} width="0.8" height="1.8" fill={catColor} />
      <rect x={x + 9.5} y={y + 6.5} width="0.8" height="1.8" fill={catColor} />

      {/* paws */}
      <circle cx={x + 4.4} cy={y + 8.3} r="0.5" fill={catColor} opacity="0.9" />
      <circle cx={x + 6.9} cy={y + 8.3} r="0.5" fill={catColor} opacity="0.9" />
      <circle cx={x + 8.4} cy={y + 8.3} r="0.5" fill={catColor} opacity="0.9" />
      <circle cx={x + 9.9} cy={y + 8.3} r="0.5" fill={catColor} opacity="0.9" />

      {/* head */}
      <circle cx={x + 10} cy={y + 4.2} r={1.8} fill={catColor} />

      {/* ears */}
      <polygon points={`${x + 9},${y + 2.5} ${x + 8.5},${y + 0.5} ${x + 9.5},${y + 2}`} fill={catColor} />
      <polygon points={`${x + 11},${y + 2.5} ${x + 11.5},${y + 0.5} ${x + 10.5},${y + 2}`} fill={catColor} />

      {/* ear inner */}
      <polygon points={`${x + 9},${y + 2.3} ${x + 8.8},${y + 1.2} ${x + 9.3},${y + 2}`} fill={C.catCream} opacity="0.6" />
      <polygon points={`${x + 11},${y + 2.3} ${x + 11.2},${y + 1.2} ${x + 10.7},${y + 2}`} fill={C.catCream} opacity="0.6" />

      {/* eyes */}
      <circle cx={x + 9.3} cy={y + 3.8} r={0.5} fill={C.eyeGold} />
      <circle cx={x + 10.7} cy={y + 3.8} r={0.5} fill={C.eyeGold} />
      <ellipse cx={x + 9.3} cy={y + 3.8} rx={0.2} ry={0.4} fill={C.catBlack} />
      <ellipse cx={x + 10.7} cy={y + 3.8} rx={0.2} ry={0.4} fill={C.catBlack} />

      {/* snout */}
      <ellipse cx={x + 10} cy={y + 4.8} rx={0.8} ry={0.6} fill={C.catCream} opacity="0.7" />

      {/* nose */}
      <polygon points={`${x + 10},${y + 4.8} ${x + 9.8},${y + 5} ${x + 10.2},${y + 5}`} fill={C.redAccent} />

      {/* mouth */}
      <path d={`M ${x + 10} ${y + 5} L ${x + 9.7} ${y + 5.3} M ${x + 10} ${y + 5} L ${x + 10.3} ${y + 5.3}`} stroke={C.redMid} strokeWidth="0.3" fill="none" />

      {/* tail (curved) */}
      <path d={`M ${x + 3.5} ${y + 5} Q ${x + 2} ${y + 4} ${x + 2.5} ${y + 2}`} stroke={catColor} strokeWidth="1.2" fill="none" strokeLinecap="round" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="8" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <circle cx={x + 7} cy={y + 4.5} r={5} fill="none" stroke={C.fireHot} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("Cat", Cat);
