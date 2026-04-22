import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Lantern: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* ceiling hook */}
      <circle cx={x + 5} cy={y} r="0.4" fill={C.metalMid} />
      <path d={`M ${x + 5} ${y + 0.4} L ${x + 5} ${y + 2}`} stroke={C.metalMid} strokeWidth="0.6" fill="none" />

      {/* lantern body (square) */}
      <rect x={x + 2} y={y + 2} width="6" height="6" fill={C.metalDark} strokeWidth="0.5" stroke={C.woodOutline} />
      <rect x={x + 2.5} y={y + 2.5} width="5" height="5" fill={C.steelDark} opacity="0.7" />

      {/* glass panels (4 sides) */}
      <rect x={x + 2.5} y={y + 2.5} width="1.3" height="5" fill={C.glassCyan} opacity="0.3" />
      <rect x={x + 6.2} y={y + 2.5} width="1.3" height="5" fill={C.glassCyan} opacity="0.3" />

      {/* top */}
      <rect x={x + 2} y={y + 2} width="6" height="0.5" fill={C.metalMid} />

      {/* bottom */}
      <rect x={x + 2} y={y + 7.5} width="6" height="0.5" fill={C.metalMid} />

      {/* candle/light (glowing inside) */}
      <circle cx={x + 5} cy={y + 4.5} r="1.2" fill={C.fireHot} opacity="0.6" />
      <circle cx={x + 5} cy={y + 4.5} r="0.8" fill={C.fireMid} opacity="0.7" />
      <circle cx={x + 5} cy={y + 4.5} r="0.4" fill={C.fireHot} opacity="0.9" />

      {/* light glow (ambient) */}
      <circle cx={x + 5} cy={y + 4.5} r="2.5" fill={C.fireHot} opacity="0.15" />

      {/* error indicator */}
      {errored && (
        <rect x={x + 1.5} y={y + 1.5} width="7" height="7" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <circle cx={x + 5} cy={y + 4.5} r="3.5" fill="none" stroke={C.fireHot} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("Lantern", Lantern);
