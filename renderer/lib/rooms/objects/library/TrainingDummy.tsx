import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const TrainingDummy: ObjectComponent = ({ x, y, working, errored, active }) => {
  const dummyGroup = working ? "anim-char-walk" : "";

  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 5} cy={y + 22} rx="4" ry="1.5" fill={C.shadow} opacity="0.4" />

      {/* post */}
      <rect x={x + 4} y={y + 14} width="2" height="8" fill={C.woodDark} />
      <rect x={x + 5} y={y + 21} width="2" height="1" fill={C.woodDark} />

      {/* cross arm */}
      <rect x={x + 1} y={y + 10} width="8" height="1" fill={C.woodMid} />

      {/* straw head */}
      <g className={dummyGroup}>
        <ellipse cx={x + 5} cy={y + 5} rx="4" ry="3" fill={C.woodMidWarm} />
        <circle cx={x + 4} cy={y + 4} r="0.6" fill={C.redAccent} />
        <circle cx={x + 6} cy={y + 4} r="0.6" fill={C.redAccent} />
        <line x1={x + 5} y1={y + 6} x2={x + 5} y2={y + 7} stroke={C.woodOutline} strokeWidth="0.5" />
      </g>

      {/* straw body */}
      <g className={dummyGroup}>
        <rect x={x + 3.5} y={y + 8} width="3" height="2" fill={C.woodMidWarm} opacity="0.7" />
      </g>

      {/* hay strands */}
      <line x1={x + 2} y1={y + 6} x2={x + 1.5} y2={y + 9} stroke={C.woodLight} strokeWidth="0.4" opacity="0.6" />
      <line x1={x + 8} y1={y + 6} x2={x + 8.5} y2={y + 9} stroke={C.woodLight} strokeWidth="0.4" opacity="0.6" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="10" height="22" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <ellipse cx={x + 5} cy={y + 5} rx="4.5" ry="3.5" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("TrainingDummy", TrainingDummy);
