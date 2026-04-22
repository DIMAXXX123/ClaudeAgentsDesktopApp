import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const ReadingDesk: ObjectComponent = ({ x, y, color, working, active }) => {
  return (
    <g>
      <ellipse cx={x + 12} cy={y + 14} rx={14} ry={2} fill={C.shadow} opacity="0.35" />
      {/* desk surface */}
      <rect x={x} y={y + 12} width="24" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 12} width="24" height="1" fill={C.woodLight} opacity="0.5" />
      {/* legs */}
      <rect x={x + 2} y={y + 14} width="2" height="6" fill={C.woodDark} />
      <rect x={x + 20} y={y + 14} width="2" height="6" fill={C.woodDark} />
      {/* open book */}
      <rect x={x + 4} y={y + 8} width="14" height="4" fill={C.parchment} />
      <rect x={x + 4} y={y + 8} width="7" height="4" fill={C.paperShade} opacity="0.5" />
      {/* text marks on pages */}
      <rect x={x + 5} y={y + 9} width="5" height="0.4" fill={C.inkDark} opacity="0.7" />
      <rect x={x + 5} y={y + 10} width="4" height="0.3" fill={C.inkDark} opacity="0.6" />
      <rect x={x + 12} y={y + 9} width="5" height="0.4" fill={C.inkDark} opacity="0.7" />
      <rect x={x + 12} y={y + 10} width="5" height="0.3" fill={C.inkDark} opacity="0.6" />
      {/* spine */}
      <rect x={x + 10.5} y={y + 8} width="1" height="4" fill={C.redDeep} />
      {/* inkwell */}
      <circle cx={x + 2} cy={y + 10} r="1.5" fill={C.metalDark} />
      <circle cx={x + 2} cy={y + 10} r="1" fill={C.inkDark} />
      {/* quill */}
      <line x1={x + 2} y1={y + 9} x2={x + 3} y2={y + 7} stroke={C.bone} strokeWidth="0.4" />
      <rect x={x + 3} y={y + 6.5} width="0.5" height="1" fill={C.goldHi} />
      {/* candle */}
      <rect x={x + 20} y={y + 8} width="2" height="4" fill={C.paper} />
      <rect x={x + 20} y={y + 8} width="2" height="0.5" fill={C.woodMid} />
      {/* flame - animate when working */}
      {working && (
        <>
          <polygon points={`${x + 21},${y + 6} ${x + 20.5},${y + 8} ${x + 21.5},${y + 8}`} fill={C.fireHot} className="animate-pulse" />
          <polygon points={`${x + 21},${y + 7} ${x + 20.7},${y + 8} ${x + 21.3},${y + 8}`} fill={C.fireMid} opacity="0.8" />
        </>
      )}
      {!working && (
        <polygon points={`${x + 21},${y + 7} ${x + 20.7},${y + 8} ${x + 21.3},${y + 8}`} fill={C.fireHot} />
      )}
    </g>
  );
};

registerObject("ReadingDesk", ReadingDesk);
