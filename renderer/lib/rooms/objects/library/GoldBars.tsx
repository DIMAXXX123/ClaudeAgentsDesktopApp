import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const GoldBars: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 8} cy={y + 8} rx={6} ry={1.5} fill={C.shadow} opacity="0.35" />

      {/* bar 1 (front left) */}
      <g>
        <rect x={x + 1} y={y + 4} width="4" height="2.5" fill={C.goldDark} />
        <rect x={x + 1} y={y + 4} width="4" height="1.5" fill={C.goldHi} opacity="0.7" />
        <rect x={x + 1} y={y + 4} width="0.5" height="2.5" fill={C.gold} opacity="0.5" />
        {/* shine edge */}
        <line x1={x + 1.5} y1={y + 4} x2={x + 1.5} y2={y + 6.5} stroke={C.goldHi} strokeWidth="0.3" opacity="0.8" />
        {/* hallmark */}
        <text x={x + 2} y={y + 5.5} fontSize="0.6" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
          Au
        </text>
      </g>

      {/* bar 2 (middle) */}
      <g>
        <rect x={x + 6} y={y + 3} width="4" height="2.5" fill={C.goldDark} />
        <rect x={x + 6} y={y + 3} width="4" height="1.5" fill={C.gold} opacity="0.8" />
        <rect x={x + 6} y={y + 3} width="0.5" height="2.5" fill={C.goldHi} opacity="0.5" />
        {/* shine edge */}
        <line x1={x + 6.5} y1={y + 3} x2={x + 6.5} y2={y + 5.5} stroke={C.goldHi} strokeWidth="0.3" opacity="0.8" />
        {/* hallmark */}
        <text x={x + 7} y={y + 4.5} fontSize="0.6" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
          999
        </text>
      </g>

      {/* bar 3 (back right) */}
      <g>
        <rect x={x + 11} y={y + 2.5} width="4" height="2.5" fill={C.goldDark} opacity="0.8" />
        <rect x={x + 11} y={y + 2.5} width="4" height="1.5" fill={C.goldHi} opacity="0.6" />
        <rect x={x + 11} y={y + 2.5} width="0.5" height="2.5" fill={C.gold} opacity="0.4" />
        {/* shine edge */}
        <line x1={x + 11.5} y1={y + 2.5} x2={x + 11.5} y2={y + 5} stroke={C.goldHi} strokeWidth="0.3" opacity="0.6" />
        {/* hallmark */}
        <text x={x + 12} y={y + 4} fontSize="0.6" fontFamily="monospace" fill={C.inkDark} fontWeight="bold" opacity="0.7">
          oz
        </text>
      </g>

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="8" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 2.5} width="14" height="4.5" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("GoldBars", GoldBars);
