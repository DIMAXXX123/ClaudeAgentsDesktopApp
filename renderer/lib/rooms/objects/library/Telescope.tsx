import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Telescope: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* tripod base */}
      <ellipse cx={x + 5} cy={y + 22} rx={6} ry={1.5} fill={C.shadow} opacity="0.35" />
      <line x1={x + 5} y1={y + 22} x2={x + 1} y2={y + 28} stroke={C.woodDark} strokeWidth="0.5" />
      <line x1={x + 5} y1={y + 22} x2={x + 9} y2={y + 28} stroke={C.woodDark} strokeWidth="0.5" />
      <line x1={x + 5} y1={y + 22} x2={x + 5} y2={y + 28} stroke={C.woodDark} strokeWidth="0.5" />
      {/* feet */}
      <rect x={x} y={y + 27} width="10" height="1" fill={C.woodDark} opacity="0.5" />
      {/* scope tube angled at 45° */}
      <g transform={`rotate(-45 ${x + 5} ${y + 22})`}>
        <rect x={x + 2} y={y - 2} width="6" height="2" fill={C.metalMid} />
        <rect x={x + 2.2} y={y - 1.7} width="5.6" height="1.4" fill={C.metalLight} opacity="0.4" />
        {/* lens at end */}
        <circle cx={x + 7.5} cy={y - 1} r="1.2" fill={C.metalBlack} />
        <circle cx={x + 7.5} cy={y - 1} r="0.8" fill={color} opacity="0.5" />
      </g>
      {/* eyepiece detail */}
      <circle cx={x + 3} cy={y + 20} r="0.8" fill={C.metalBlack} />
      <circle cx={x + 3} cy={y + 20} r="0.5" fill={C.metalDark} />
      {/* focus ring */}
      <circle cx={x + 4} cy={y + 18} r="1.2" fill="none" stroke={C.gold} strokeWidth="0.2" />
    </g>
  );
};

registerObject("Telescope", Telescope);
