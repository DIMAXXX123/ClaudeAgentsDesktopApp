import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const BalanceScale: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 7} cy={y + 18} rx={5} ry={1.5} fill={C.shadow} opacity="0.35" />

      {/* pedestal base */}
      <polygon points={`${x + 2},${y + 16} ${x + 12},${y + 16} ${x + 11.5},${y + 18} ${x + 2.5},${y + 18}`} fill={C.metalDark} />
      <polygon points={`${x + 3},${y + 18} ${x + 11},${y + 18} ${x + 10.5},${y + 18.5} ${x + 3.5},${y + 18.5}`} fill={C.steelMid} />

      {/* pedestal column */}
      <rect x={x + 6} y={y + 10} width="2" height="6" fill={C.metalMid} />
      <rect x={x + 6.5} y={y + 10} width="1" height="6" fill={C.metalLight} opacity="0.4" />

      {/* balance beam */}
      <rect x={x + 2} y={y + 9.5} width="10" height="0.8" fill={C.goldDark} />
      <rect x={x + 2} y={y + 9.5} width="10" height="0.5" fill={C.goldHi} opacity="0.6" />

      {/* fulcrum (center pivot) */}
      <polygon points={`${x + 7},${y + 10.2} ${x + 6.5},${y + 10.8} ${x + 7.5},${y + 10.8}`} fill={C.steelMid} />
      <circle cx={x + 7} cy={y + 10.5} r="0.3" fill={C.metalShine} />

      {/* left pan (hanging) */}
      <rect x={x + 2.5} y={y + 11} width="3" height="0.8" fill={C.gold} />
      <rect x={x + 2.5} y={y + 11.8} width="3" height="0.5" fill={C.goldDark} />
      {/* left chains */}
      <line x1={x + 3} y1={y + 11} x2={x + 3} y2={y + 12.5} stroke={C.metalMid} strokeWidth="0.4" />
      <line x1={x + 4.5} y1={y + 11} x2={x + 4.5} y2={y + 12.5} stroke={C.metalMid} strokeWidth="0.4" />

      {/* right pan (hanging) */}
      <rect x={x + 8.5} y={y + 11} width="3" height="0.8" fill={C.gold} />
      <rect x={x + 8.5} y={y + 11.8} width="3" height="0.5" fill={C.goldDark} />
      {/* right chains */}
      <line x1={x + 9} y1={y + 11} x2={x + 9} y2={y + 12.5} stroke={C.metalMid} strokeWidth="0.4" />
      <line x1={x + 10.5} y1={y + 11} x2={x + 10.5} y2={y + 12.5} stroke={C.metalMid} strokeWidth="0.4" />

      {/* weights in pans */}
      <rect x={x + 3} y={y + 12.3} width="1.5" height="1" fill={C.metalMid} />
      <rect x={x + 8.5} y={y + 12.3} width="1.5" height="1" fill={C.metalMid} />

      {/* balance needle (indicator) */}
      <line x1={x + 7} y1={y + 10} x2={x + 7} y2={y + 8.5} stroke={C.metalHi} strokeWidth="0.6" />
      <circle cx={x + 7} cy={y + 8.5} r="0.4" fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="18" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <ellipse cx={x + 7} cy={y + 9.5} rx={6} ry={4} fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("BalanceScale", BalanceScale);
