import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const TacticalCRT: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 9} cy={y + 14} rx="8" ry="2" fill={C.shadow} opacity="0.35" />

      {/* cabinet frame */}
      <rect x={x} y={y} width="18" height="14" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="16" height="12" fill={C.crtBg} />

      {/* CRT bezel */}
      <rect x={x + 2} y={y + 1.5} width="14" height="10" fill={C.metalDark} strokeWidth="1" stroke={C.woodOutline} />
      <rect x={x + 3} y={y + 2.5} width="12" height="8" fill={working ? C.crtBg : C.velvetDeep} />

      {/* alert glow when working */}
      {working && (
        <>
          {/* red scanlines */}
          <line x1={x + 3} y1={y + 3} x2={x + 15} y2={y + 3} stroke={C.redAccent} strokeWidth="0.2" opacity="0.6" />
          <line x1={x + 3} y1={y + 4} x2={x + 15} y2={y + 4} stroke={C.redAccent} strokeWidth="0.2" opacity="0.4" />
          <line x1={x + 3} y1={y + 5.5} x2={x + 15} y2={y + 5.5} stroke={C.redAccent} strokeWidth="0.2" opacity="0.5" />
          <line x1={x + 3} y1={y + 7} x2={x + 15} y2={y + 7} stroke={C.redAccent} strokeWidth="0.2" opacity="0.6" />
          <line x1={x + 3} y1={y + 8.5} x2={x + 15} y2={y + 8.5} stroke={C.redAccent} strokeWidth="0.2" opacity="0.4" />

          {/* stack trace text simulation */}
          <text x={x + 4} y={y + 4.5} fontSize="1" fontFamily="monospace" fill={C.redAccent} opacity="0.7">
            ERROR
          </text>
          <line x1={x + 4} y1={y + 5.5} x2={x + 13} y2={y + 5.5} stroke={C.redAccent} strokeWidth="0.3" opacity="0.5" />
          <line x1={x + 4} y1={y + 6.5} x2={x + 12} y2={y + 6.5} stroke={C.redAccent} strokeWidth="0.3" opacity="0.5" />
          <line x1={x + 4} y1={y + 7.5} x2={x + 11} y2={y + 7.5} stroke={C.redAccent} strokeWidth="0.3" opacity="0.5" />
        </>
      )}

      {/* power button area */}
      <rect x={x + 8} y={y + 11} width="2" height="1" fill={C.metalMid} />
      <circle cx={x + 9} cy={y + 11.5} r="0.5" fill={working ? C.redAccent : C.metalHi} className={working ? "anim-crt-flicker" : ""} />

      {/* control knobs */}
      <circle cx={x + 4} cy={y + 12} r="0.6" fill={C.metalMid} />
      <line x1={x + 4} y1={y + 11.5} x2={x + 4} y2={y + 11} stroke={C.metalHi} strokeWidth="0.3" />

      <circle cx={x + 14} cy={y + 12} r="0.6" fill={C.metalMid} />
      <line x1={x + 14} y1={y + 11.5} x2={x + 14} y2={y + 11} stroke={C.metalHi} strokeWidth="0.3" />

      {/* stand */}
      <polygon points={`${x + 5},${y + 13} ${x + 13},${y + 13} ${x + 14},${y + 14} ${x + 4},${y + 14}`} fill={C.metalDark} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="18" height="14" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 1.5} width="14" height="10" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("TacticalCRT", TacticalCRT);
