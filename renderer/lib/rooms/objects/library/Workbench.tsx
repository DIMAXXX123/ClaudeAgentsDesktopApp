import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Workbench: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      <ellipse cx={x + 15} cy={y + 12} rx={16} ry={2} fill={C.shadow} opacity="0.35" />
      {/* top surface */}
      <rect x={x} y={y + 10} width="30" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 10} width="30" height="1" fill={C.woodLight} opacity="0.5" />
      {/* legs */}
      <rect x={x + 2} y={y + 12} width="2" height="6" fill={C.woodDark} />
      <rect x={x + 26} y={y + 12} width="2" height="6" fill={C.woodDark} />
      {/* tools scattered on bench */}
      {/* hammer */}
      <g>
        <rect x={x + 2} y={y + 8} width="1" height="2" fill={C.woodMid} />
        <rect x={x + 1} y={y + 7.5} width="3" height="1" fill={C.metalMid} />
      </g>
      {/* wrench */}
      <g transform={`rotate(30 ${x + 8} ${y + 9})`}>
        <rect x={x + 6} y={y + 8} width="4" height="1" fill={C.metalMid} />
        <circle cx={x + 8} cy={y + 8.5} r="0.7" fill={C.metalBlack} />
      </g>
      {/* chisel */}
      <g transform={`rotate(-20 ${x + 16} ${y + 9})`}>
        <rect x={x + 15} y={y + 8} width="0.6" height="2.5" fill={C.metalMid} />
        <rect x={x + 15.2} y={y + 7.5} width="0.2" height="0.5" fill={C.metalLight} />
      </g>
      {/* saw */}
      <g>
        <line x1={x + 22} y1={y + 8} x2={x + 28} y2={y + 10} stroke={C.metalMid} strokeWidth="0.4" />
        <line x1={x + 22} y1={y + 8.2} x2={x + 28} y2={y + 10.2} stroke={C.metalMid} strokeWidth="0.2" />
      </g>
      {/* scattered nails/bolts */}
      {[4, 10, 14, 20, 24].map((xi) => (
        <rect key={`nail-${xi}`} x={x + xi} y={y + 9.5} width="0.4" height="0.8" fill={C.metalDark} />
      ))}
    </g>
  );
};

registerObject("Workbench", Workbench);
