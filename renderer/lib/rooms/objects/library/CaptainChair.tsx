import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CaptainChair: ObjectComponent = ({ x, y, color, working, active }) => {
  return (
    <g>
      <ellipse cx={x + 4} cy={y + 11} rx={6} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* base */}
      <rect x={x} y={y + 10} width="8" height="2" fill={C.metalDark} />
      <rect x={x - 1} y={y + 12} width="10" height="1" fill={C.metalBlack} />
      {/* column */}
      <rect x={x + 3} y={y + 2} width="2" height="8" fill={C.metalDark} />
      {/* seat */}
      <rect x={x - 1} y={y + 1} width="10" height="2" fill={C.metalDark} />
      <rect x={x - 1} y={y} width="10" height="1" fill={C.metalLight} />
      {/* backrest */}
      <rect x={x} y={y - 6} width="8" height="7" fill={C.metalDark} />
      <rect x={x + 1} y={y - 5} width="6" height="5" fill={color} opacity="0.6" />
      <rect x={x + 1} y={y - 3} width="6" height="1" fill={color} opacity="0.8" />
      {/* armrests */}
      <rect x={x - 2} y={y + 3} width="2" height="3" fill={C.metalDark} />
      <rect x={x + 8} y={y + 3} width="2" height="3" fill={C.metalDark} />
      {active && (
        <rect x={x + 9} y={y + 4} width="1" height="1" fill={color} className="animate-pulse" />
      )}
    </g>
  );
};

registerObject("CaptainChair", CaptainChair);
