import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BugBoard: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* cork background */}
      <rect x={x} y={y} width="24" height="18" fill={C.pot} />
      <rect x={x + 1} y={y + 1} width="22" height="16" fill={C.potDark} opacity="0.7" />

      {/* cork texture */}
      <circle cx={x + 4} cy={y + 3} r="1" fill={C.pot} opacity="0.5" />
      <circle cx={x + 10} cy={y + 5} r="0.8" fill={C.pot} opacity="0.5" />
      <circle cx={x + 18} cy={y + 4} r="0.9" fill={C.pot} opacity="0.5" />
      <circle cx={x + 6} cy={y + 12} r="1.2" fill={C.pot} opacity="0.5" />
      <circle cx={x + 16} cy={y + 14} r="0.7" fill={C.pot} opacity="0.5" />

      {/* pinned bug cards (red dots) */}
      <circle cx={x + 5} cy={y + 4} r="1.2" fill={C.redAccent} />
      <circle cx={x + 12} cy={y + 6} r="1" fill={C.redAccent} />
      <circle cx={x + 19} cy={y + 8} r="1.1" fill={C.redAccent} />
      <circle cx={x + 8} cy={y + 13} r="1" fill={C.redAccent} />

      {/* pins */}
      <circle cx={x + 5} cy={y + 4} r="0.4" fill={C.metalShine} />
      <circle cx={x + 12} cy={y + 6} r="0.4" fill={C.metalShine} />
      <circle cx={x + 19} cy={y + 8} r="0.4" fill={C.metalShine} />
      <circle cx={x + 8} cy={y + 13} r="0.4" fill={C.metalShine} />

      {/* yellow sticky notes */}
      <rect x={x + 3} y={y + 9} width="4" height="3" fill={C.goldHi} opacity="0.8" />
      <rect x={x + 14} y={y + 11} width="4" height="3" fill={C.goldHi} opacity="0.8" />

      {/* note lines */}
      <line x1={x + 4} y1={y + 10} x2={x + 6} y2={y + 10} stroke={C.inkDark} strokeWidth="0.3" />
      <line x1={x + 4} y1={y + 10.8} x2={x + 6.5} y2={y + 10.8} stroke={C.inkDark} strokeWidth="0.3" />
      <line x1={x + 15} y1={y + 12} x2={x + 17} y2={y + 12} stroke={C.inkDark} strokeWidth="0.3" />
      <line x1={x + 15} y1={y + 12.8} x2={x + 17.5} y2={y + 12.8} stroke={C.inkDark} strokeWidth="0.3" />

      {/* frame */}
      <rect x={x} y={y} width="24" height="18" fill="none" stroke={C.woodDark} strokeWidth="1" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="24" height="18" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="22" height="16" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("BugBoard", BugBoard);
