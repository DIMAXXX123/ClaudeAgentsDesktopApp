import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CRTMonitor: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 10} cy={y + 15} rx={12} ry={2} fill={C.shadow} opacity="0.35" />
      {/* bezel frame */}
      <rect x={x} y={y} width="20" height="14" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="18" height="12" fill={C.woodOutline} />
      {/* screen */}
      <rect x={x + 2} y={y + 2} width="16" height="10" fill={working ? color : C.crtBg} opacity={working ? 0.8 : 1} />
      {working ? (
        <>
          {/* scanlines */}
          <rect x={x + 2} y={y + 3} width="16" height="0.3" fill="#000" opacity="0.4" />
          <rect x={x + 2} y={y + 5} width="16" height="0.3" fill="#000" opacity="0.4" />
          <rect x={x + 2} y={y + 7} width="16" height="0.3" fill="#000" opacity="0.4" />
          <rect x={x + 2} y={y + 9} width="16" height="0.3" fill="#000" opacity="0.4" />
          {/* text simulation */}
          <rect x={x + 4} y={y + 4} width="12" height="0.6" fill="#fff" opacity="0.8" />
          <rect x={x + 4} y={y + 6} width="8" height="0.6" fill="#fff" opacity="0.6" />
          <rect x={x + 4} y={y + 8} width="10" height="0.6" fill="#fff" opacity="0.7" />
          <rect x={x + 4} y={y + 10} width="3" height="0.8" fill="#fff" className="anim-cursor-blink" />
        </>
      ) : (
        <>
          {/* idle grid */}
          <rect x={x + 4} y={y + 4} width="12" height="0.5" fill={color} opacity="0.5" />
          <rect x={x + 4} y={y + 6} width="10" height="0.5" fill={color} opacity="0.4" />
          <rect x={x + 4} y={y + 8} width="12" height="0.5" fill={color} opacity="0.5" />
          <circle cx={x + 14} cy={y + 10} r="0.6" fill={color} className="animate-pulse" />
        </>
      )}
      {/* stand */}
      <rect x={x + 7} y={y + 12} width="6" height="2" fill={C.metalDark} />
      <rect x={x + 5} y={y + 14} width="10" height="1" fill={C.metalMid} />
    </g>
  );
};

registerObject("CRTMonitor", CRTMonitor);
