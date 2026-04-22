import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CableSnake: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* coiled cables (snaking pattern) */}
      <path
        d={`M ${x + 2} ${y + 2} Q ${x + 4} ${y + 3} ${x + 6} ${y + 2} T ${x + 10} ${y + 2} T ${x + 14} ${y + 2}`}
        stroke={C.metalMid}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d={`M ${x + 2.5} ${y + 2.5} Q ${x + 4} ${y + 3.3} ${x + 5.5} ${y + 2.5} T ${x + 9.5} ${y + 2.5} T ${x + 13.5} ${y + 2.5}`}
        stroke={C.steelLight}
        strokeWidth="0.8"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* lower coil */}
      <path
        d={`M ${x + 3} ${y + 3.5} Q ${x + 5} ${y + 4} ${x + 7} ${y + 3.5} T ${x + 11} ${y + 3.5}`}
        stroke={C.metalDark}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* connectors on left */}
      <circle cx={x + 1.5} cy={y + 2} r="0.5" fill={C.metalShine} />
      <circle cx={x + 1.5} cy={y + 3.5} r="0.5" fill={C.metalShine} />

      {/* connectors on right */}
      <circle cx={x + 14.5} cy={y + 2} r="0.5" fill={C.metalShine} />
      <circle cx={x + 14.5} cy={y + 3.5} r="0.5" fill={C.metalShine} />

      {/* cable ties */}
      <rect x={x + 5} y={y + 2.8} width="1" height="0.6" fill={C.metalMid} opacity="0.7" />
      <rect x={x + 9} y={y + 2.8} width="1" height="0.6" fill={C.metalMid} opacity="0.7" />
      <rect x={x + 12} y={y + 2.8} width="1" height="0.6" fill={C.metalMid} opacity="0.7" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="4" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <path
            d={`M ${x + 2} ${y + 2} Q ${x + 4} ${y + 3} ${x + 6} ${y + 2} T ${x + 10} ${y + 2} T ${x + 14} ${y + 2}`}
            stroke={C.glassCyan}
            strokeWidth="2.5"
            fill="none"
            opacity="0.6"
          />
        </g>
      )}
    </g>
  );
};

registerObject("CableSnake", CableSnake);
