import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const SignalMortar: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* base pedestal */}
      <rect x={x + 3} y={y + 8} width="8" height="4" fill={C.metalDark} />
      <rect x={x + 2} y={y + 12} width="10" height="1" fill={C.metalMid} />
      <polygon points={`${x + 1},${y + 12} ${x + 13},${y + 12} ${x + 12.5},${y + 13} ${x + 1.5},${y + 13}`} fill={C.metalBlack} />

      {/* barrel (pointing up-right at 45 degrees) */}
      <line x1={x + 7} y1={y + 8} x2={x + 11} y2={y + 2} stroke={C.steelMid} strokeWidth="2" strokeLinecap="round" />
      <line x1={x + 7} y1={y + 7.5} x2={x + 11} y2={y + 1.5} stroke={C.steelLight} strokeWidth="0.8" />

      {/* barrel breech (cylindrical section) */}
      <circle cx={x + 7.5} cy={y + 7} r="1" fill={C.metalDark} />
      <circle cx={x + 7.5} cy={y + 7} r="0.8" fill={C.steelMid} opacity="0.5" />

      {/* firing mechanism (lever) */}
      <rect x={x + 5.5} y={y + 8.5} width="3" height="0.6" fill={C.metalMid} />
      <circle cx={x + 5.5} cy={y + 8.8} r="0.4" fill={C.metalShine} />

      {/* signal light (when working) */}
      {working && (
        <>
          <circle cx={x + 11} cy={y + 2} r="1.5" fill={C.fireHot} opacity="0.7" className="anim-obj-glow-work" />
          <circle cx={x + 11} cy={y + 2} r="0.8" fill={C.fireHot} />
        </>
      )}

      {/* idle marker */}
      {!working && (
        <circle cx={x + 11} cy={y + 2} r="0.6" fill={C.metalShine} />
      )}

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="12" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <circle cx={x + 7.5} cy={y + 7} r="1.5" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("SignalMortar", SignalMortar);
