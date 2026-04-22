import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BeaconLight: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 3} cy={y + 10} rx="2" ry="1" fill={C.shadow} opacity="0.35" />

      {/* pole */}
      <rect x={x + 2.5} y={y + 4} width="1" height="6" fill={C.steelMid} />
      <rect x={x + 2.8} y={y + 4} width="0.4" height="6" fill={C.steelLight} opacity="0.4" />

      {/* lamp housing */}
      <circle cx={x + 3} cy={y + 2.5} r="2" fill={C.metalDark} />
      <circle cx={x + 3} cy={y + 2.5} r="1.8" fill={C.steelMid} opacity="0.6" />

      {/* lens (glass front) */}
      <circle cx={x + 3} cy={y + 2.5} r="1.5" fill={C.glassCyan} opacity="0.3" />

      {/* beacon light (rotating red) */}
      {working && (
        <>
          <circle cx={x + 3} cy={y + 2.5} r="1.2" fill={C.redAccent} opacity="0.8" className="anim-obj-glow-work" />
          <circle cx={x + 3} cy={y + 2.5} r="0.8" fill={C.fireHot} className="anim-obj-glow-work" />
          <circle cx={x + 3} cy={y + 2.5} r="0.4" fill={C.fireHot} opacity="0.9" />
        </>
      )}

      {/* idle state */}
      {!working && (
        <>
          <circle cx={x + 3} cy={y + 2.5} r="1.2" fill={C.metalMid} opacity="0.5" />
          <circle cx={x + 3} cy={y + 2.5} r="0.6" fill={C.metalHi} opacity="0.5" />
        </>
      )}

      {/* base mount */}
      <rect x={x + 1.5} y={y + 9.5} width="3" height="0.5" fill={C.metalBlack} />
      <polygon points={`${x + 1},${y + 10} ${x + 5},${y + 10} ${x + 5.5},${y + 10.5} ${x + 0.5},${y + 10.5}`} fill={C.metalDark} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="6" height="10" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <circle cx={x + 3} cy={y + 2.5} r="2.2" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("BeaconLight", BeaconLight);
