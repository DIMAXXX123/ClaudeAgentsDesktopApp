import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const TickerBoard: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 20} cy={y + 10} rx={18} ry={1.5} fill={C.shadow} opacity="0.3" />

      {/* frame border */}
      <rect x={x} y={y} width="40" height="10" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="38" height="8" fill={C.crtBgAmber} />

      {/* display window */}
      <rect x={x + 2} y={y + 1.5} width="36" height="7" fill={working ? C.crtBgAmber : "#1a1610"} />

      {/* ticker text (animated scroll) */}
      {working && (
        <>
          <text x={x + 35} y={y + 5.5} fontSize="2" fontFamily="monospace" fill={C.glassAmber} fontWeight="bold" className="anim-obj-glow-work">
            $BTC 69K
          </text>
          <text x={x + 23} y={y + 5.5} fontSize="2" fontFamily="monospace" fill={C.glassAmber} fontWeight="bold">
            ▲ $ETH 3.5K
          </text>
          <text x={x + 8} y={y + 5.5} fontSize="2" fontFamily="monospace" fill={C.glassAmber} fontWeight="bold" opacity="0.7">
            SOL 180 ▼
          </text>
        </>
      )}

      {/* idle state - static ticker */}
      {!working && (
        <>
          <text x={x + 5} y={y + 5.5} fontSize="2" fontFamily="monospace" fill={C.glassAmber} opacity="0.4" fontWeight="bold">
            -- MARKET --
          </text>
        </>
      )}

      {/* mechanical elements (gear indicators) */}
      <circle cx={x + 3} cy={y + 8.5} r="0.5" fill={C.metalMid} />
      <line x1={x + 3} y1={y + 8} x2={x + 3} y2={y + 7.5} stroke={C.metalHi} strokeWidth="0.3" className={working ? "anim-gear-cw" : ""} />

      <circle cx={x + 37} cy={y + 8.5} r="0.5" fill={C.metalMid} />
      <line x1={x + 37} y1={y + 8} x2={x + 37} y2={y + 7.5} stroke={C.metalHi} strokeWidth="0.3" className={working ? "anim-gear-cw" : ""} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="40" height="10" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 1.5} width="36" height="7" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("TickerBoard", TickerBoard);
