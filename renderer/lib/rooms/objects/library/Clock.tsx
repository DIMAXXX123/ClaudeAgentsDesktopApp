import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Clock: ObjectComponent = ({ x, y, errored, active }) => {
  const now = new Date();
  const seconds = now.getSeconds();
  const secondAngle = (seconds * 360) / 60;

  return (
    <g>
      {/* mounting bracket */}
      <circle cx={x + 5} cy={y - 1} r="0.4" fill={C.metalMid} />
      <rect x={x + 4.5} y={y - 1} width="1" height="1.5" fill={C.metalMid} opacity="0.6" />

      {/* clock face frame */}
      <circle cx={x + 5} cy={y + 4} r={4.5} fill={C.metalBlack} />
      <circle cx={x + 5} cy={y + 4} r={4} fill={C.paper} />

      {/* hour markers */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = Math.cos(rad) * 3.5;
        const y1 = Math.sin(rad) * 3.5;
        const x2 = Math.cos(rad) * 3;
        const y2 = Math.sin(rad) * 3;
        return (
          <line
            key={i}
            x1={x + 5 + x1}
            y1={y + 4 + y1}
            x2={x + 5 + x2}
            y2={y + 4 + y2}
            stroke={C.inkDark}
            strokeWidth="0.3"
          />
        );
      })}

      {/* hour hand */}
      <line x1={x + 5} y1={y + 4} x2={x + 5} y2={y + 2.5} stroke={C.metalDark} strokeWidth="0.7" strokeLinecap="round" />

      {/* minute hand */}
      <line x1={x + 5} y1={y + 4} x2={x + 5} y2={y + 1} stroke={C.metalMid} strokeWidth="0.6" strokeLinecap="round" />

      {/* second hand (animated) */}
      <g transform={`rotate(${secondAngle} ${x + 5} ${y + 4})`}>
        <line x1={x + 5} y1={y + 4} x2={x + 5} y2={y + 1.5} stroke={C.redAccent} strokeWidth="0.3" strokeLinecap="round" />
      </g>

      {/* center spindle */}
      <circle cx={x + 5} cy={y + 4} r={0.5} fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <circle cx={x + 5} cy={y + 4} r={4.5} fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <circle cx={x + 5} cy={y + 4} r={5} fill="none" stroke={C.fireHot} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("Clock", Clock);
