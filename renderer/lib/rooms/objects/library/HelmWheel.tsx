import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const HelmWheel: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 7} cy={y + 10} rx={8} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* hub */}
      <circle cx={x + 7} cy={y + 6} r="2" fill={C.metalDark} />
      <circle cx={x + 7} cy={y + 6} r="1.2" fill={C.metalLight} />
      {/* spokes and rim */}
      <g className={working ? "anim-gear-cw" : ""} style={{ transformOrigin: `${x + 7}px ${y + 6}px` }}>
        {/* wheel outline */}
        <circle cx={x + 7} cy={y + 6} r="6" fill="none" stroke={C.gold} strokeWidth="0.4" />
        {/* 4 spokes */}
        <line x1={x + 7} y1={y + 1} x2={x + 7} y2={y + 3} stroke={C.gold} strokeWidth="0.3" />
        <line x1={x + 13} y1={y + 6} x2={x + 11} y2={y + 6} stroke={C.gold} strokeWidth="0.3" />
        <line x1={x + 7} y1={y + 11} x2={x + 7} y2={y + 9} stroke={C.gold} strokeWidth="0.3" />
        <line x1={x + 1} y1={y + 6} x2={x + 3} y2={y + 6} stroke={C.gold} strokeWidth="0.3" />
        {/* diagonal braces */}
        <line x1={x + 10} y1={y + 2} x2={x + 10} y2={y + 4} stroke={C.goldDark} strokeWidth="0.2" />
        <line x1={x + 10} y1={y + 8} x2={x + 10} y2={y + 10} stroke={C.goldDark} strokeWidth="0.2" />
        <line x1={x + 4} y1={y + 8} x2={x + 4} y2={y + 10} stroke={C.goldDark} strokeWidth="0.2" />
        <line x1={x + 4} y1={y + 2} x2={x + 4} y2={y + 4} stroke={C.goldDark} strokeWidth="0.2" />
      </g>
      {/* mounting bracket */}
      <rect x={x + 5} y={y + 9} width="4" height="2" fill={C.metalDark} />
      <rect x={x + 4} y={y + 11} width="6" height="1" fill={C.metalBlack} />
    </g>
  );
};

registerObject("HelmWheel", HelmWheel);
