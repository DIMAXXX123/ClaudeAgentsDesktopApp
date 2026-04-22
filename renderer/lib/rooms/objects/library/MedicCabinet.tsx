import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const MedicCabinet: ObjectComponent = ({ x, y, errored, active }) => {
  return (
    <g>
      {/* cabinet base (white) */}
      <rect x={x} y={y} width="14" height="18" fill="#ffffff" />
      <rect x={x + 1} y={y + 1} width="12" height="16" fill={C.paper} opacity="0.9" />

      {/* red cross (front) */}
      <rect x={x + 4} y={y + 4} width="6" height="1" fill={C.redAccent} />
      <rect x={x + 5.5} y={y + 2.5} width="1" height="5" fill={C.redAccent} />

      {/* door outline */}
      <rect x={x + 2} y={y + 2} width="10" height="12" fill="none" stroke={C.woodOutline} strokeWidth="1" />

      {/* hinge */}
      <circle cx={x + 2.5} cy={y + 4} r="0.5" fill={C.metalDark} />
      <circle cx={x + 2.5} cy={y + 12} r="0.5" fill={C.metalDark} />

      {/* handle */}
      <rect x={x + 11.5} y={y + 7.5} width="1.5" height="0.8" fill={C.metalMid} />
      <circle cx={x + 13} cy={y + 7.9} r="0.4" fill={C.metalShine} />

      {/* shelf lines inside */}
      <line x1={x + 3} y1={y + 6} x2={x + 11} y2={y + 6} stroke={C.woodOutline} strokeWidth="0.3" opacity="0.5" />
      <line x1={x + 3} y1={y + 10} x2={x + 11} y2={y + 10} stroke={C.woodOutline} strokeWidth="0.3" opacity="0.5" />

      {/* medicine bottles (small rects) */}
      <rect x={x + 4} y={y + 7} width="1" height="1.5" fill={C.glassCyan} opacity="0.6" />
      <rect x={x + 6} y={y + 7} width="1" height="1.5" fill={C.glassCyan} opacity="0.6" />
      <rect x={x + 8} y={y + 7} width="1" height="1.5" fill={C.glassCyan} opacity="0.6" />

      {/* bottom trim */}
      <rect x={x} y={y + 16} width="14" height="2" fill={C.woodDark} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="18" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="12" height="16" fill="none" stroke={C.glassMagenta} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("MedicCabinet", MedicCabinet);
