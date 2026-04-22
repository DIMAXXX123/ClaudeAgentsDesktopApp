import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const NeonSign: ObjectComponent = ({ x, y, working, extra, errored, active }) => {
  const text = (extra?.text as string) || "NEON";
  const glowColor = (extra?.glow as string) || C.glassMagenta;

  return (
    <g>
      {/* mounting bracket */}
      <rect x={x + 10} y={y - 1} width="4" height="1" fill={C.metalMid} />
      <circle cx={x + 11} cy={y - 0.5} r="0.4" fill={C.metalShine} />
      <circle cx={x + 13} cy={y - 0.5} r="0.4" fill={C.metalShine} />

      {/* sign frame (metal) */}
      <rect x={x} y={y} width="24" height="8" fill={C.metalBlack} strokeWidth="0.5" stroke={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width="22" height="6" fill={C.metalDark} opacity="0.7" />

      {/* neon glow background when working */}
      {working && (
        <>
          <rect x={x + 2} y={y + 1.5} width="20" height="5" fill={glowColor} opacity="0.15" className="anim-obj-glow-work" />
          <filter id="neon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
          </filter>
        </>
      )}

      {/* text (neon tube simulation) */}
      <text
        x={x + 12}
        y={y + 5}
        fontSize="4"
        fontFamily="monospace"
        fill={working ? glowColor : C.metalMid}
        opacity={working ? 0.9 : 0.3}
        textAnchor="middle"
        fontWeight="bold"
        className={working ? "anim-obj-glow-work" : ""}
        style={{ filter: working ? "url(#neon-glow)" : "none" }}
      >
        {text.substring(0, 5)}
      </text>

      {/* flicker effect when working */}
      {working && (
        <g className="anim-crt-flicker" opacity="0.3">
          <rect x={x + 2} y={y + 1.5} width="20" height="5" fill={glowColor} />
        </g>
      )}

      {/* power indicator (small LED) */}
      <circle cx={x + 23} cy={y + 0.5} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="24" height="8" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="22" height="6" fill="none" stroke={glowColor} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("NeonSign", NeonSign);
