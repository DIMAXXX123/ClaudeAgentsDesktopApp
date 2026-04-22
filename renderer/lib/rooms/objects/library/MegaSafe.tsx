import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const MegaSafe: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 12} cy={y + 24} rx={10} ry={2} fill={C.shadow} opacity="0.3" />

      {/* main safe body */}
      <rect x={x} y={y} width="24" height="24" fill={C.metalBlack} strokeWidth="2" stroke={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="22" height="22" fill={C.steelDark} opacity="0.8" />

      {/* safe door frame */}
      <rect x={x + 2} y={y + 2} width="20" height="20" fill={C.metalDark} />
      <rect x={x + 3} y={y + 3} width="18" height="18" fill={C.steelMid} opacity="0.5" />

      {/* door seams */}
      <line x1={x + 2} y1={y + 2} x2={x + 22} y2={y + 2} stroke={C.woodOutline} strokeWidth="0.5" />
      <line x1={x + 2} y1={y + 22} x2={x + 22} y2={y + 22} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.5" />
      <line x1={x + 2} y1={y + 2} x2={x + 2} y2={y + 22} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.5" />

      {/* gold dial (center) */}
      <circle cx={x + 12} cy={y + 12} r="6" fill={C.goldDark} />
      <circle cx={x + 12} cy={y + 12} r="5.5" fill={C.gold} />
      <circle cx={x + 12} cy={y + 12} r="5" fill={C.goldHi} opacity="0.6" />

      {/* dial numbers (markers) */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = Math.cos(rad) * 4;
        const y1 = Math.sin(rad) * 4;
        return (
          <line
            key={i}
            x1={x + 12 + x1 * 0.7}
            y1={y + 12 + y1 * 0.7}
            x2={x + 12 + x1}
            y2={y + 12 + y1}
            stroke={C.inkDark}
            strokeWidth="0.4"
          />
        );
      })}

      {/* needle pointer */}
      <line x1={x + 12} y1={y + 12} x2={x + 12} y2={y + 8} stroke={C.metalHi} strokeWidth="0.8" />

      {/* center spindle */}
      <circle cx={x + 12} cy={y + 12} r="0.6" fill={C.metalShine} />

      {/* handle (top) */}
      <rect x={x + 10} y={y - 1} width="4" height="1" fill={C.goldDark} />
      <circle cx={x + 10.5} cy={y - 0.5} r="0.4" fill={C.metalShine} />
      <circle cx={x + 13.5} cy={y - 0.5} r="0.4" fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="24" height="24" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <circle cx={x + 12} cy={y + 12} r="7" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("MegaSafe", MegaSafe);
