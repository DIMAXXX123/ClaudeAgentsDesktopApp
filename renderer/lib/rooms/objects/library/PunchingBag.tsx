import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const PunchingBag: ObjectComponent = ({ x, y, working, errored, active }) => {
  const bagTilt = working ? "anim-obj-glow-work" : "";

  return (
    <g>
      {/* ceiling attachment */}
      <rect x={x + 3} y={y} width="2" height="1" fill={C.metalDark} />
      <circle cx={x + 3.5} cy={y + 1} r="0.3" fill={C.metalShine} />
      <circle cx={x + 4.5} cy={y + 1} r="0.3" fill={C.metalShine} />

      {/* chain links */}
      <line x1={x + 4} y1={y + 1} x2={x + 4} y2={y + 4} stroke={C.metalMid} strokeWidth="0.4" />
      <circle cx={x + 4} cy={y + 2} r="0.3" fill={C.metalDark} />
      <circle cx={x + 4} cy={y + 3} r="0.3" fill={C.metalDark} />

      {/* bag body (heavy) */}
      <g className={bagTilt}>
        <ellipse cx={x + 4} cy={y + 12} rx="3.5" ry="5" fill={C.redMid} />
        <ellipse cx={x + 4} cy={y + 12} rx="3.3" ry="4.8" fill={C.redDeep} opacity="0.6" />

        {/* stitches */}
        <line x1={x + 4} y1={y + 7} x2={x + 4} y2={y + 17} stroke={C.woodOutline} strokeWidth="0.3" />
        <line x1={x + 2} y1={y + 9} x2={x + 6} y2={y + 9} stroke={C.woodOutline} strokeWidth="0.2" opacity="0.5" />
        <line x1={x + 1.5} y1={y + 12} x2={x + 6.5} y2={y + 12} stroke={C.woodOutline} strokeWidth="0.2" opacity="0.5" />
        <line x1={x + 2} y1={y + 15} x2={x + 6} y2={y + 15} stroke={C.woodOutline} strokeWidth="0.2" opacity="0.5" />
      </g>

      {/* bottom reinforcement */}
      <ellipse cx={x + 4} cy={y + 18} rx="3" ry="1" fill={C.woodDark} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="8" height="24" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <ellipse cx={x + 4} cy={y + 12} rx="4" ry="5.5" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("PunchingBag", PunchingBag);
