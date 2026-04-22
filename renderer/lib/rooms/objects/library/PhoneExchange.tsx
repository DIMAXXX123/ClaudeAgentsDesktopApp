import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const PhoneExchange: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 12} cy={y + 18} rx="10" ry="2" fill={C.shadow} opacity="0.3" />

      {/* main cabinet */}
      <rect x={x} y={y} width="24" height="18" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="22" height="16" fill={C.steelDark} opacity="0.7" />

      {/* jack field (grid of holes) */}
      {[0, 4, 8, 12, 16, 20].map((col, ci) =>
        [1, 4, 7, 10, 13].map((row, ri) => (
          <g key={`${ci}-${ri}`}>
            <circle cx={x + 3 + col} cy={y + 2 + row} r="0.8" fill={C.metalDark} />
            <circle cx={x + 3 + col} cy={y + 2 + row} r="0.5" fill={working ? C.fireHot : C.metalMid} />
          </g>
        ))
      )}

      {/* connecting cables/wires (sample) */}
      <line x1={x + 3} y1={y + 2} x2={x + 7} y2={y + 4} stroke={C.metalMid} strokeWidth="0.6" opacity="0.6" />
      <line x1={x + 7} y1={y + 4} x2={x + 11} y2={y + 2} stroke={C.metalMid} strokeWidth="0.6" opacity="0.6" />
      <line x1={x + 11} y1={y + 2} x2={x + 15} y2={y + 5} stroke={C.metalMid} strokeWidth="0.6" opacity="0.6" />
      <line x1={x + 3} y1={y + 7} x2={x + 8} y2={y + 10} stroke={C.metalMid} strokeWidth="0.6" opacity="0.5" />
      <line x1={x + 12} y1={y + 7} x2={x + 19} y2={y + 11} stroke={C.metalMid} strokeWidth="0.6" opacity="0.5" />

      {/* connecting jacks on right (plug endpoints) */}
      <rect x={x + 20} y={y + 3} width="2" height="1" fill={C.metalMid} />
      <circle cx={x + 21} cy={y + 3.5} r="0.4" fill={C.metalShine} />

      <rect x={x + 20} y={y + 6} width="2" height="1" fill={C.metalMid} />
      <circle cx={x + 21} cy={y + 6.5} r="0.4" fill={C.metalShine} />

      <rect x={x + 20} y={y + 9} width="2" height="1" fill={C.metalMid} />
      <circle cx={x + 21} cy={y + 9.5} r="0.4" fill={C.metalShine} />

      {/* operator headset jack (bottom right) */}
      <rect x={x + 19} y={y + 15} width="3" height="1.5" fill={C.goldDark} />
      <circle cx={x + 20.5} cy={y + 15.75} r="0.5" fill={C.metalShine} />

      {/* label area */}
      <rect x={x + 2} y={y + 14} width="20" height="2" fill={C.woodOutline} opacity="0.5" />
      <text x={x + 5} y={y + 15} fontSize="1" fontFamily="monospace" fill={C.metalHi}>
        SWITCHBOARD
      </text>

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="24" height="18" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="22" height="16" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("PhoneExchange", PhoneExchange);
