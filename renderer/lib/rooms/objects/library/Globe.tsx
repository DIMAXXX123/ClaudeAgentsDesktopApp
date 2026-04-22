import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Globe: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      <ellipse cx={x + 7} cy={y + 15} rx={8} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* wooden stand */}
      <rect x={x + 4} y={y + 12} width="6" height="3" fill={C.woodMid} />
      <rect x={x + 2} y={y + 15} width="10" height="1" fill={C.woodDark} />
      {/* support ring */}
      <ellipse cx={x + 7} cy={y + 10} rx={5} ry={1.5} fill="none" stroke={C.gold} strokeWidth="0.3" />
      {/* sphere body */}
      <circle cx={x + 7} cy={y + 8} r="5" fill={C.paper} />
      {/* ocean regions (dark patches) */}
      <circle cx={x + 5} cy={y + 6} r="1.5" fill={C.skyMid} opacity="0.5" />
      <circle cx={x + 9} cy={y + 8} r="1.5" fill={C.skyMid} opacity="0.5" />
      <circle cx={x + 6} cy={y + 11} r="1" fill={C.skyMid} opacity="0.4" />
      {/* continents (land) */}
      <path d={`M ${x + 3} ${y + 7} Q ${x + 4} ${y + 6} ${x + 5} ${y + 7}`} fill={C.grassDark} />
      <path d={`M ${x + 9} ${y + 9} Q ${x + 10} ${y + 10} ${x + 11} ${y + 9}`} fill={C.grassDark} />
      {/* equator line */}
      <ellipse cx={x + 7} cy={y + 8} rx={5} ry={0.5} fill="none" stroke={C.goldHi} strokeWidth="0.2" opacity="0.6" />
      {/* highlight on sphere */}
      <circle cx={x + 4} cy={y + 5} r="1" fill="#fff" opacity="0.3" />
    </g>
  );
};

registerObject("Globe", Globe);
