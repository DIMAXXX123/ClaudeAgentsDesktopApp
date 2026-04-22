import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BrassCompass: ObjectComponent = ({ x, y, working }) => {
  return (
    <g>
      <ellipse cx={x + 4} cy={y + 8} rx={5} ry={1} fill={C.shadow} opacity="0.35" />
      {/* outer ring */}
      <circle cx={x + 4} cy={y + 4} r="4" fill={C.gold} />
      <circle cx={x + 4} cy={y + 4} r="3.6" fill={C.paper} />
      {/* cardinal marks */}
      <text x={x + 4} y={y + 1.5} fontSize="1.5" textAnchor="middle" fill={C.inkDark} fontFamily="monospace">N</text>
      <text x={x + 7} y={y + 4.5} fontSize="1" textAnchor="middle" fill={C.inkDark} fontFamily="monospace">E</text>
      <text x={x + 1} y={y + 4.5} fontSize="1" textAnchor="middle" fill={C.inkDark} fontFamily="monospace">W</text>
      {/* compass needle */}
      <g className={working ? "anim-gear-cw" : ""} style={{ transformOrigin: `${x + 4}px ${y + 4}px` }}>
        <rect x={x + 3.7} y={y + 1.5} width="0.6" height="2.2" fill={C.redDeep} />
        <rect x={x + 3.7} y={y + 4.3} width="0.6" height="1.8" fill={C.metalDark} />
      </g>
      {/* center dot */}
      <circle cx={x + 4} cy={y + 4} r="0.4" fill={C.metalBlack} />
    </g>
  );
};

registerObject("BrassCompass", BrassCompass);
