import { registerObject } from "../registry";
import { C, SK } from "../../palette";
import type { ObjectComponent } from "../../types";

export const WallArt: ObjectComponent = ({ x, y, extra, errored, active }) => {
  const variant = (extra?.variant as string) || "portrait";

  return (
    <g>
      {/* frame (gold) */}
      <rect x={x} y={y} width="16" height="12" fill={C.goldDark} />
      <rect x={x + 1} y={y + 1} width="14" height="10" fill={C.gold} />
      <rect x={x + 2} y={y + 2} width="12" height="8" fill={C.metalBlack} />

      {/* artwork content */}
      <rect x={x + 2.5} y={y + 2.5} width="11" height="7" fill={C.paper} opacity="0.8" />

      {/* art variations */}
      {variant === "portrait" && (
        <>
          {/* simple portrait */}
          <circle cx={x + 8} cy={y + 4} r={1.5} fill={SK.skin} />
          <circle cx={x + 7.2} cy={y + 3.7} r={0.4} fill={SK.eyeDark} />
          <circle cx={x + 8.8} cy={y + 3.7} r={0.4} fill={SK.eyeDark} />
          <line x1={x + 8} y1={y + 4.5} x2={x + 8} y2={y + 4.8} stroke={SK.mouth} strokeWidth="0.4" />
          <path d={`M ${x + 7.5} ${y + 5} Q ${x + 8} ${y + 5.5} ${x + 8.5} ${y + 5}`} stroke={SK.mouth} strokeWidth="0.5" fill="none" />
        </>
      )}

      {variant === "landscape" && (
        <>
          {/* simple landscape */}
          <line x1={x + 3} y1={y + 6.5} x2={x + 13} y2={y + 6.5} stroke={C.grassDark} strokeWidth="0.5" />
          <polygon points={`${x + 5},${y + 6.5} ${x + 7},${y + 4} ${x + 9},${y + 6.5}`} fill={C.leaves} />
          <polygon points={`${x + 10},${y + 6.5} ${x + 11.5},${y + 5} ${x + 13},${y + 6.5}`} fill={C.leavesDark} />
          <circle cx={x + 4} cy={y + 3.5} r={1} fill={C.fireHot} opacity="0.7" />
        </>
      )}

      {variant === "abstract" && (
        <>
          {/* abstract shapes */}
          <rect x={x + 3} y={y + 3} width={3} height={3} fill={C.redAccent} opacity="0.6" />
          <circle cx={x + 9} cy={y + 4.5} r={1.5} fill={C.glassCyan} opacity="0.5" />
          <polygon points={`${x + 11},${y + 3} ${x + 12},${y + 4} ${x + 11},${y + 5}`} fill={C.goldHi} opacity="0.6" />
          <line x1={x + 3.5} y1={y + 7} x2={x + 12} y2={y + 7} stroke={C.metalMid} strokeWidth="0.5" opacity="0.5" />
        </>
      )}

      {/* frame depth */}
      <rect x={x} y={y} width="16" height="12" fill="none" stroke={C.woodOutline} strokeWidth="1" />

      {/* wall reflection */}
      <rect x={x + 2.5} y={y + 2.5} width="11" height="1" fill={C.metalHi} opacity="0.15" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="12" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="14" height="10" fill="none" stroke={C.fireHot} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("WallArt", WallArt);
