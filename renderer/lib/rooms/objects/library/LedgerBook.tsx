import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const LedgerBook: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 5} cy={y + 8} rx={3.5} ry={1} fill={C.shadow} opacity="0.35" />

      {/* book spine (left edge) */}
      <rect x={x} y={y + 0.5} width="1.5" height="7" fill={C.woodDark} />
      <rect x={x + 0.3} y={y + 0.5} width="0.5" height="7" fill={C.woodLight} opacity="0.5" />

      {/* book front cover */}
      <rect x={x + 1.5} y={y} width="8" height="7.5" fill={C.woodMid} />
      <rect x={x + 1.5} y={y} width="8" height="7.5" fill={C.parchment} opacity="0.4" />

      {/* embossed title */}
      <text x={x + 2.5} y={y + 2} fontSize="1" fontFamily="serif" fill={C.goldDark} fontWeight="bold">
        LEDGER
      </text>

      {/* decorative line */}
      <line x1={x + 2} y1={y + 3.5} x2={x + 9} y2={y + 3.5} stroke={C.goldDark} strokeWidth="0.4" opacity="0.6" />

      {/* year/date */}
      <text x={x + 3} y={y + 5.5} fontSize="0.7" fontFamily="monospace" fill={C.inkDark} opacity="0.8">
        1920
      </text>

      {/* corner decoration */}
      <circle cx={x + 2} cy={y + 1} r="0.4" fill={C.goldDark} opacity="0.5" />
      <circle cx={x + 9} cy={y + 1} r="0.4" fill={C.goldDark} opacity="0.5" />
      <circle cx={x + 2} cy={y + 6.5} r="0.4" fill={C.goldDark} opacity="0.5" />
      <circle cx={x + 9} cy={y + 6.5} r="0.4" fill={C.goldDark} opacity="0.5" />

      {/* pages edge (closed) */}
      <rect x={x + 1.8} y={y + 7.2} width="7.4" height="0.4" fill={C.paper} opacity="0.6" />
      <line x1={x + 1.8} y1={y + 7.3} x2={x + 9.2} y2={y + 7.3} stroke={C.woodOutline} strokeWidth="0.2" opacity="0.5" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="10" height="8" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1.5} y={y} width="8" height="7.5" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("LedgerBook", LedgerBook);
