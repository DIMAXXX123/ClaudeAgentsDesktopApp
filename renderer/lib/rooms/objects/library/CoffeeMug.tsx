import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CoffeeMug: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 2.5} cy={y + 5} rx={2} ry={0.8} fill={C.shadow} opacity="0.3" />

      {/* mug body */}
      <ellipse cx={x + 2.5} cy={y + 3.5} rx={2} ry={1.5} fill={C.fireHot} opacity="0.9" />
      <rect x={x + 0.8} y={y + 2} width="3.4" height="2.5" fill={C.fireHot} opacity="0.85" />
      <ellipse cx={x + 2.5} cy={y + 4.5} rx={1.8} ry={1} fill={C.fireMid} opacity="0.7" />

      {/* coffee inside */}
      <ellipse cx={x + 2.5} cy={y + 2.5} rx={1.5} ry={0.8} fill={C.inkDark} opacity="0.8" />

      {/* handle */}
      <path d={`M ${x + 4.2} ${y + 2.5} Q ${x + 5.2} ${y + 2.5} ${x + 5.2} ${y + 4}`} stroke={C.fireHot} strokeWidth="0.6" fill="none" strokeLinecap="round" />

      {/* rim (highlight) */}
      <ellipse cx={x + 2.5} cy={y + 2} rx={1.8} ry={0.5} fill={C.fireHot} opacity="0.6" />

      {/* steam effect when working */}
      {working && (
        <>
          <path d={`M ${x + 1.5} ${y + 1.5} Q ${x + 1} ${y + 0.5} ${x + 1.5} ${y - 0.5}`} stroke={C.smoke} strokeWidth="0.4" fill="none" className="anim-steam-rise" opacity="0.7" />
          <path d={`M ${x + 2.5} ${y + 1} Q ${x + 2} ${y + 0} ${x + 2.5} ${y - 1}`} stroke={C.smoke} strokeWidth="0.4" fill="none" className="anim-steam-rise" opacity="0.6" />
          <path d={`M ${x + 3.5} ${y + 1.5} Q ${x + 4} ${y + 0.5} ${x + 3.5} ${y - 0.5}`} stroke={C.smoke} strokeWidth="0.4" fill="none" className="anim-steam-rise" opacity="0.7" />
        </>
      )}

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="5" height="5" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <ellipse cx={x + 2.5} cy={y + 3.5} rx={2.5} ry={2} fill="none" stroke={C.fireHot} strokeWidth="1" opacity="0.6" className="anim-obj-pulse-active" />
      )}
    </g>
  );
};

registerObject("CoffeeMug", CoffeeMug);
