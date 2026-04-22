import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const AmmoCrate: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 8} cy={y + 10} rx="7" ry="1.5" fill={C.shadow} opacity="0.3" />

      {/* main crate */}
      <rect x={x + 1} y={y + 2} width="14" height="8" fill={C.woodMid} />
      <rect x={x + 1} y={y + 2} width="14" height="8" fill={C.woodLight} opacity="0.3" />

      {/* wood planks */}
      <line x1={x + 1} y1={y + 4} x2={x + 15} y2={y + 4} stroke={C.woodOutline} strokeWidth="0.5" />
      <line x1={x + 1} y1={y + 6} x2={x + 15} y2={y + 6} stroke={C.woodOutline} strokeWidth="0.5" />

      {/* stencil "AMMO" text */}
      <text x={x + 4} y={y + 5.5} fontSize="2" fontFamily="monospace" fill={C.redAccent} fontWeight="bold">
        AMMO
      </text>

      {/* rope handle (top curved) */}
      <path d={`M ${x + 4} ${y + 2} Q ${x + 8} ${y - 1} ${x + 12} ${y + 2}`} stroke={C.woodMidWarm} strokeWidth="0.8" fill="none" />
      <circle cx={x + 4} cy={y + 2} r="0.4" fill={C.woodDark} />
      <circle cx={x + 12} cy={y + 2} r="0.4" fill={C.woodDark} />

      {/* side reinforcements */}
      <line x1={x} y1={y + 2} x2={x} y2={y + 10} stroke={C.woodOutline} strokeWidth="1" />
      <line x1={x + 16} y1={y + 2} x2={x + 16} y2={y + 10} stroke={C.woodOutline} strokeWidth="1" />

      {/* bottom shadow */}
      <rect x={x + 1} y={y + 9} width="14" height="1" fill={C.shadow} opacity="0.4" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="10" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 2} width="14" height="8" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("AmmoCrate", AmmoCrate);
