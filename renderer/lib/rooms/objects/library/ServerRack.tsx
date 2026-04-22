import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const ServerRack: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 6} cy={y + 32} rx="5" ry="1.5" fill={C.shadow} opacity="0.3" />

      {/* rack frame */}
      <rect x={x} y={y} width="12" height="32" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="10" height="30" fill={C.steelDark} opacity="0.8" />

      {/* vertical rails */}
      <line x1={x + 1.5} y1={y + 1} x2={x + 1.5} y2={y + 31} stroke={C.metalHi} strokeWidth="0.5" opacity="0.6" />
      <line x1={x + 10.5} y1={y + 1} x2={x + 10.5} y2={y + 31} stroke={C.metalHi} strokeWidth="0.5" opacity="0.6" />

      {/* server modules (6 rows) */}
      {[0, 5, 10, 15, 20, 25].map((offset, i) => (
        <g key={i}>
          {/* module bezel */}
          <rect x={x + 2} y={y + 2 + offset} width="8" height="4" fill={C.metalDark} />
          <rect x={x + 2.5} y={y + 2.5 + offset} width="7" height="3" fill={C.steelMid} opacity="0.5" />

          {/* LED indicators */}
          <circle
            cx={x + 3.5}
            cy={y + 3.5 + offset}
            r="0.5"
            fill={working ? C.glassGreen : C.metalMid}
            className={working ? "anim-obj-glow-work" : ""}
          />
          <circle
            cx={x + 5}
            cy={y + 3.5 + offset}
            r="0.5"
            fill={working ? C.fireHot : C.metalMid}
            className={working ? "anim-obj-glow-work" : ""}
          />
          <circle
            cx={x + 6.5}
            cy={y + 3.5 + offset}
            r="0.5"
            fill={working ? C.glassGreen : C.metalMid}
            className={working ? "anim-obj-glow-work" : ""}
          />
          <circle cx={x + 8} cy={y + 3.5 + offset} r="0.5" fill={C.metalHi} opacity="0.4" />
        </g>
      ))}

      {/* power connector (bottom) */}
      <rect x={x + 4.5} y={y + 30} width="3" height="1" fill={C.metalDark} />
      <circle cx={x + 5} cy={y + 30.5} r="0.4" fill={C.redAccent} />
      <circle cx={x + 6.5} cy={y + 30.5} r="0.4" fill={C.glassGreen} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="12" height="32" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="10" height="30" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("ServerRack", ServerRack);
