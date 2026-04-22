import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Abacus: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 7} cy={y + 10} rx={5} ry={1.3} fill={C.shadow} opacity="0.35" />

      {/* wooden frame */}
      <rect x={x} y={y} width="14" height="10" fill={C.woodMid} strokeWidth="1" stroke={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="12" height="8" fill={C.woodLight} opacity="0.4" />

      {/* corner posts */}
      <circle cx={x + 1} cy={y + 1} r="0.4" fill={C.woodDark} />
      <circle cx={x + 13} cy={y + 1} r="0.4" fill={C.woodDark} />
      <circle cx={x + 1} cy={y + 9} r="0.4" fill={C.woodDark} />
      <circle cx={x + 13} cy={y + 9} r="0.4" fill={C.woodDark} />

      {/* rods (5 horizontal rods) */}
      {[1.5, 3, 4.5, 6, 7.5].map((rodY, ri) => (
        <g key={`rod-${ri}`}>
          {/* rod line */}
          <line x1={x + 2} y1={y + rodY} x2={x + 12} y2={y + rodY} stroke={C.woodOutline} strokeWidth="0.4" />

          {/* beads on rod (different positions) */}
          {[2.5, 4.5, 6.5, 8.5, 10].map((bx, bi) => {
            const offset = (ri + bi) % 3;
            const beadColor = [C.fireHot, C.redAccent, C.goldHi][offset];
            return (
              <circle key={`bead-${bi}`} cx={x + bx} cy={y + rodY} r="0.6" fill={beadColor} opacity="0.8" />
            );
          })}
        </g>
      ))}

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="10" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="12" height="8" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("Abacus", Abacus);
