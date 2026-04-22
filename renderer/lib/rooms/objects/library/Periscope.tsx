import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Periscope: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* base */}
      <rect x={x} y={y + 25} width="4" height="3" fill={C.metalDark} />
      <rect x={x - 1} y={y + 28} width="6" height="1" fill={C.metalBlack} />
      {/* vertical tube */}
      <rect x={x + 1} y={y} width="2" height="25" fill={C.metalMid} />
      <rect x={x + 1.3} y={y} width="1.4" height="25" fill={C.metalLight} opacity="0.5" />
      {/* top optics */}
      <rect x={x} y={y - 1} width="4" height="1" fill={C.metalDark} />
      <circle cx={x + 2} cy={y - 1.5} r="1.5" fill={C.metalBlack} />
      <circle cx={x + 2} cy={y - 1.5} r="1" fill={color} opacity="0.3" />
      {/* focus detail */}
      <rect x={x + 0.5} y={y - 0.8} width="3" height="0.5" fill={C.metalLight} opacity="0.6" />
      {/* eyepiece at bottom */}
      <circle cx={x + 2} cy={y + 28} r="1" fill={C.metalBlack} />
      <circle cx={x + 2} cy={y + 28} r="0.6" fill={C.metalDark} />
    </g>
  );
};

registerObject("Periscope", Periscope);
