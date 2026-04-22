import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Microscope: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 5} cy={y + 14} rx={6} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* base platform */}
      <rect x={x + 1} y={y + 12} width="8" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 14} width="10" height="1" fill={C.woodDark} />
      {/* vertical support column */}
      <rect x={x + 4} y={y + 4} width="2" height="8" fill={C.metalMid} />
      <rect x={x + 4.3} y={y + 4} width="1.4" height="8" fill={C.metalLight} opacity="0.4" />
      {/* stage (where sample sits) */}
      <rect x={x + 2} y={y + 8} width="6" height="4" fill={C.metalDark} />
      <rect x={x + 3} y={y + 8.5} width="4" height="2" fill={working ? color : C.metalBlack} opacity={working ? 0.6 : 1} />
      {/* adjustment knob */}
      <circle cx={x + 2} cy={y + 6} r="1" fill={C.gold} />
      <rect x={x + 1.6} y={y + 5.2} width="0.8" height="1.4" fill={C.goldDark} />
      {/* objective lens */}
      <rect x={x + 4} y={y + 1} width="2" height="3" fill={C.metalMid} />
      <circle cx={x + 5} cy={y + 0.5} r="1.2" fill={C.metalBlack} />
      <circle cx={x + 5} cy={y + 0.5} r="0.8" fill={C.metalDark} />
      {/* eyepiece */}
      <rect x={x + 4} y={y + 2} width="2" height="1" fill={C.metalDark} />
      <circle cx={x + 5} cy={y + 1.3} r="0.7" fill={C.metalBlack} />
    </g>
  );
};

registerObject("Microscope", Microscope);
