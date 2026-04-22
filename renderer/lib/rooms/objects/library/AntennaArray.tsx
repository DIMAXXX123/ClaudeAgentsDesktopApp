import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const AntennaArray: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 4} cy={y + 30} rx="3" ry="1.5" fill={C.shadow} opacity="0.3" />

      {/* main mast (vertical) */}
      <rect x={x + 3.5} y={y} width="1" height="30" fill={C.steelMid} />
      <rect x={x + 3.7} y={y} width="0.6" height="30" fill={C.steelLight} opacity="0.4" />

      {/* crossbar 1 (top) */}
      <g>
        <line x1={x + 1} y1={y + 6} x2={x + 7} y2={y + 6} stroke={C.steelMid} strokeWidth="0.8" strokeLinecap="round" />
        <circle cx={x + 1} cy={y + 6} r="0.5" fill={C.metalMid} />
        <circle cx={x + 7} cy={y + 6} r="0.5" fill={C.metalMid} />
        {/* elements on bar 1 */}
        <line x1={x + 1.5} y1={y + 6} x2={x + 1.5} y2={y + 3} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 3} y1={y + 6} x2={x + 3} y2={y + 2} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 4.5} y1={y + 6} x2={x + 4.5} y2={y + 3} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 6} y1={y + 6} x2={x + 6} y2={y + 3.5} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
      </g>

      {/* crossbar 2 (middle) */}
      <g>
        <line x1={x + 1.5} y1={y + 14} x2={x + 6.5} y2={y + 14} stroke={C.steelMid} strokeWidth="0.8" strokeLinecap="round" />
        <circle cx={x + 1.5} cy={y + 14} r="0.5" fill={C.metalMid} />
        <circle cx={x + 6.5} cy={y + 14} r="0.5" fill={C.metalMid} />
        {/* elements on bar 2 */}
        <line x1={x + 2.5} y1={y + 14} x2={x + 2.5} y2={y + 11} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 4} y1={y + 14} x2={x + 4} y2={y + 10} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 5.5} y1={y + 14} x2={x + 5.5} y2={y + 11} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
      </g>

      {/* crossbar 3 (lower) */}
      <g>
        <line x1={x + 1} y1={y + 22} x2={x + 7} y2={y + 22} stroke={C.steelMid} strokeWidth="0.8" strokeLinecap="round" />
        <circle cx={x + 1} cy={y + 22} r="0.5" fill={C.metalMid} />
        <circle cx={x + 7} cy={y + 22} r="0.5" fill={C.metalMid} />
        {/* elements on bar 3 */}
        <line x1={x + 1.5} y1={y + 22} x2={x + 1.5} y2={y + 19} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 3} y1={y + 22} x2={x + 3} y2={y + 18} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 4.5} y1={y + 22} x2={x + 4.5} y2={y + 19} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
        <line x1={x + 6} y1={y + 22} x2={x + 6} y2={y + 19.5} stroke={C.steelMid} strokeWidth="0.5" strokeLinecap="round" />
      </g>

      {/* base */}
      <rect x={x + 2.5} y={y + 28} width="3" height="2" fill={C.metalDark} />
      <polygon points={`${x + 1},${y + 28} ${x + 7},${y + 28} ${x + 7.5},${y + 30} ${x + 0.5},${y + 30}`} fill={C.metalBlack} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="8" height="30" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <line x1={x + 3.5} y1={y} x2={x + 3.5} y2={y + 30} stroke={C.glassCyan} strokeWidth="1.5" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("AntennaArray", AntennaArray);
