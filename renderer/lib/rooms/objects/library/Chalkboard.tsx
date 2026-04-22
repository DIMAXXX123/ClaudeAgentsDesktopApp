import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Chalkboard: ObjectComponent = ({ x, y, color }) => {
  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width="32" height="20" fill={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="30" height="18" fill={C.woodDark} />
      {/* board surface */}
      <rect x={x + 2} y={y + 2} width="28" height="16" fill={C.metalBlack} />
      {/* chalk markings (random equations/formulas) */}
      <line x1={x + 5} y1={y + 5} x2={x + 12} y2={y + 5} stroke="#fff" strokeWidth="0.4" opacity="0.8" />
      <line x1={x + 5} y1={y + 7} x2={x + 10} y2={y + 7} stroke="#fff" strokeWidth="0.3" opacity="0.7" />
      <line x1={x + 5} y1={y + 9} x2={x + 14} y2={y + 9} stroke="#fff" strokeWidth="0.4" opacity="0.8" />
      <line x1={x + 5} y1={y + 11} x2={x + 9} y2={y + 11} stroke="#fff" strokeWidth="0.3" opacity="0.7" />
      <line x1={x + 5} y1={y + 13} x2={x + 13} y2={y + 13} stroke="#fff" strokeWidth="0.4" opacity="0.8" />
      {/* right side equations */}
      <line x1={x + 18} y1={y + 5} x2={x + 28} y2={y + 5} stroke={color} strokeWidth="0.3" opacity="0.6" />
      <line x1={x + 18} y1={y + 7} x2={x + 26} y2={y + 7} stroke={color} strokeWidth="0.3" opacity="0.6" />
      <line x1={x + 18} y1={y + 9} x2={x + 29} y2={y + 9} stroke={color} strokeWidth="0.3" opacity="0.6" />
      <line x1={x + 18} y1={y + 11} x2={x + 25} y2={y + 11} stroke={color} strokeWidth="0.3" opacity="0.6" />
      {/* chalk dust smudge */}
      <rect x={x + 6} y={y + 15} width="18" height="2" fill="#fff" opacity="0.1" />
      {/* chalk at bottom */}
      <rect x={x + 2} y={y + 18} width="28" height="1" fill="#fff" opacity="0.15" />
    </g>
  );
};

registerObject("Chalkboard", Chalkboard);
