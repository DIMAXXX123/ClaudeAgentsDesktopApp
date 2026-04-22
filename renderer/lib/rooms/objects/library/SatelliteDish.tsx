import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const SatelliteDish: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 11} cy={y + 20} rx="9" ry="2" fill={C.shadow} opacity="0.3" />

      {/* mounting pole */}
      <rect x={x + 10} y={y + 10} width="2" height="10" fill={C.steelMid} />
      <rect x={x + 10.5} y={y + 10} width="1" height="10" fill={C.steelLight} opacity="0.4" />

      {/* base */}
      <polygon points={`${x + 6},${y + 20} ${x + 16},${y + 20} ${x + 17},${y + 21} ${x + 5},${y + 21}`} fill={C.metalDark} />

      {/* dish (parabolic shape, tilted up 45 deg) */}
      <g transform={`rotate(-45 ${x + 11} ${y + 8})`}>
        <ellipse cx={x + 11} cy={y + 8} rx="7" ry="5" fill={C.steelMid} opacity="0.8" />
        <ellipse cx={x + 11} cy={y + 8} rx="6.5" ry="4.5" fill={C.steelLight} opacity="0.4" />

        {/* dish grid lines */}
        <line x1={x + 5} y1={y + 8} x2={x + 17} y2={y + 8} stroke={C.steelDark} strokeWidth="0.4" opacity="0.5" />
        <line x1={x + 6} y1={y + 5} x2={x + 16} y2={y + 11} stroke={C.steelDark} strokeWidth="0.4" opacity="0.5" />
        <line x1={x + 6} y1={y + 11} x2={x + 16} y2={y + 5} stroke={C.steelDark} strokeWidth="0.4" opacity="0.5" />
      </g>

      {/* feed horn at center */}
      <circle cx={x + 11} cy={y + 7} r="1" fill={C.metalBlack} />
      <circle cx={x + 11} cy={y + 7} r="0.6" fill={C.glassCyan} opacity="0.6" />

      {/* receiver cables */}
      <line x1={x + 10} y1={y + 19} x2={x + 6} y2={y + 19} stroke={C.metalMid} strokeWidth="1" />
      <line x1={x + 12} y1={y + 19} x2={x + 16} y2={y + 19} stroke={C.metalMid} strokeWidth="1" />

      {/* connectors */}
      <circle cx={x + 6} cy={y + 19} r="0.5" fill={C.metalShine} />
      <circle cx={x + 16} cy={y + 19} r="0.5" fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="22" height="20" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <circle cx={x + 11} cy={y + 7} r="1.5" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("SatelliteDish", SatelliteDish);
