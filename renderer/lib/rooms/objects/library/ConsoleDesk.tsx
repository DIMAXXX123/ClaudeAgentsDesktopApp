import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const ConsoleDesk: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 16} cy={y + 14} rx={14} ry={2} fill={C.shadow} opacity="0.3" />

      {/* desk top */}
      <rect x={x} y={y + 11} width="32" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 12} width="32" height="1" fill={C.woodLight} opacity="0.5" />

      {/* desk front panel */}
      <rect x={x} y={y + 3} width="32" height="8" fill={C.steelDark} opacity="0.7" />

      {/* monitor 1 (left) */}
      <g>
        <rect x={x + 2} y={y} width="8" height="8" fill={C.metalBlack} />
        <rect x={x + 3} y={y + 1} width="6" height="6" fill={C.metalDark} strokeWidth="0.5" stroke={C.woodOutline} />
        <rect x={x + 3.5} y={y + 1.5} width="5" height="5" fill={working ? C.crtBg : C.velvetDeep} />
        {working && (
          <rect x={x + 4} y={y + 2.5} width="4" height="3" fill={C.glassCyan} opacity="0.4" />
        )}
        <circle cx={x + 6} cy={y + 7.5} r="0.5" fill={C.metalMid} />
      </g>

      {/* monitor 2 (center) */}
      <g>
        <rect x={x + 12} y={y} width="8" height="8" fill={C.metalBlack} />
        <rect x={x + 13} y={y + 1} width="6" height="6" fill={C.metalDark} strokeWidth="0.5" stroke={C.woodOutline} />
        <rect x={x + 13.5} y={y + 1.5} width="5" height="5" fill={working ? C.crtBgGreen : C.velvetDeep} />
        {working && (
          <rect x={x + 14} y={y + 2.5} width="4" height="3" fill={C.glassGreen} opacity="0.4" />
        )}
        <circle cx={x + 16} cy={y + 7.5} r="0.5" fill={C.metalMid} />
      </g>

      {/* monitor 3 (right) */}
      <g>
        <rect x={x + 22} y={y} width="8" height="8" fill={C.metalBlack} />
        <rect x={x + 23} y={y + 1} width="6" height="6" fill={C.metalDark} strokeWidth="0.5" stroke={C.woodOutline} />
        <rect x={x + 23.5} y={y + 1.5} width="5" height="5" fill={working ? C.crtBgAmber : C.velvetDeep} />
        {working && (
          <rect x={x + 24} y={y + 2.5} width="4" height="3" fill={C.glassAmber} opacity="0.4" />
        )}
        <circle cx={x + 26} cy={y + 7.5} r="0.5" fill={C.metalMid} />
      </g>

      {/* keyboard area */}
      <rect x={x + 4} y={y + 10} width="24" height="1" fill={C.metalDark} />
      <rect x={x + 5} y={y + 10.2} width="22" height="0.6" fill={C.steelMid} />

      {/* key dots */}
      {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20].map((offset, i) => (
        <circle key={i} cx={x + 7 + offset} cy={y + 10.5} r="0.25" fill={C.metalLight} opacity="0.6" />
      ))}

      {/* mouse area */}
      <circle cx={x + 29} cy={y + 10.5} r="0.8" fill={C.metalDark} />
      <circle cx={x + 29} cy={y + 10.5} r="0.6" fill={C.steelLight} opacity="0.5" />

      {/* cable channel */}
      <rect x={x + 8} y={y + 13} width="16" height="0.5" fill={C.metalMid} opacity="0.4" />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="32" height="14" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 2} y={y} width="8" height="8" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
          <rect x={x + 12} y={y} width="8" height="8" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
          <rect x={x + 22} y={y} width="8" height="8" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("ConsoleDesk", ConsoleDesk);
