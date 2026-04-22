import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Oscilloscope: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 8} cy={y + 12} rx="6" ry="1.5" fill={C.shadow} opacity="0.35" />

      {/* cabinet */}
      <rect x={x} y={y} width="16" height="12" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="14" height="10" fill={C.crtBgGreen} />

      {/* CRT screen */}
      <rect x={x + 2} y={y + 1.5} width="12" height="7" fill={C.metalDark} strokeWidth="1" stroke={C.woodOutline} />
      <rect x={x + 3} y={y + 2.5} width="10" height="5" fill={working ? C.crtBgGreen : C.velvetDeep} />

      {/* waveform visualization */}
      {working && (
        <>
          {/* grid lines */}
          <line x1={x + 3.5} y1={y + 5} x2={x + 12.5} y2={y + 5} stroke={C.glassGreen} strokeWidth="0.2" opacity="0.5" />
          <line x1={x + 3.5} y1={y + 4} x2={x + 12.5} y2={y + 4} stroke={C.glassGreen} strokeWidth="0.2" opacity="0.3" />
          <line x1={x + 3.5} y1={y + 6} x2={x + 12.5} y2={y + 6} stroke={C.glassGreen} strokeWidth="0.2" opacity="0.3" />

          {/* sine wave (stepped) */}
          <polyline
            points={`${x + 4},${y + 5} ${x + 5},${y + 3.5} ${x + 6},${y + 3} ${x + 7},${y + 3.5} ${x + 8},${y + 5} ${x + 9},${y + 6.5} ${x + 10},${y + 6.8} ${x + 11},${y + 6.5} ${x + 12},${y + 5}`}
            stroke={C.glassGreen}
            strokeWidth="0.6"
            fill="none"
            className={working ? "anim-obj-glow-work" : ""}
          />
        </>
      )}

      {/* knobs (top) */}
      <circle cx={x + 3} cy={y + 9} r="0.6" fill={C.metalMid} />
      <line x1={x + 3} y1={y + 8.5} x2={x + 3} y2={y + 8} stroke={C.metalHi} strokeWidth="0.3" />

      <circle cx={x + 6} cy={y + 9} r="0.6" fill={C.metalMid} />
      <line x1={x + 6} y1={y + 8.5} x2={x + 6} y2={y + 8} stroke={C.metalHi} strokeWidth="0.3" />

      <circle cx={x + 9} cy={y + 9} r="0.6" fill={C.metalMid} />
      <line x1={x + 9} y1={y + 8.5} x2={x + 9} y2={y + 8} stroke={C.metalHi} strokeWidth="0.3" />

      <circle cx={x + 12} cy={y + 9} r="0.6" fill={C.metalMid} />
      <line x1={x + 12} y1={y + 8.5} x2={x + 12} y2={y + 8} stroke={C.metalHi} strokeWidth="0.3" />

      {/* probe ports (right) */}
      <circle cx={x + 15} cy={y + 4} r="0.4" fill={C.redAccent} />
      <circle cx={x + 15} cy={y + 6} r="0.4" fill={C.metalMid} />

      {/* stand legs */}
      <line x1={x + 2} y1={y + 11} x2={x + 1.5} y2={y + 12} stroke={C.metalDark} strokeWidth="0.8" />
      <line x1={x + 14} y1={y + 11} x2={x + 14.5} y2={y + 12} stroke={C.metalDark} strokeWidth="0.8" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="16" height="12" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y + 1.5} width="12" height="7" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("Oscilloscope", Oscilloscope);
