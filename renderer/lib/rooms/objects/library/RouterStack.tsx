import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const RouterStack: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 7} cy={y + 10} rx="5" ry="1.5" fill={C.shadow} opacity="0.3" />

      {/* router 1 (bottom) */}
      <rect x={x + 1} y={y + 6} width="12" height="3" fill={C.metalDark} />
      <rect x={x + 2} y={y + 6.5} width="10" height="2" fill={C.steelMid} opacity="0.6" />

      {/* LEDs on router 1 */}
      <circle cx={x + 2.5} cy={y + 7} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 4} cy={y + 7} r="0.4" fill={working ? C.fireHot : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 5.5} cy={y + 7} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />

      {/* router 2 (middle) */}
      <rect x={x + 1} y={y + 3} width="12" height="3" fill={C.metalDark} />
      <rect x={x + 2} y={y + 3.5} width="10" height="2" fill={C.steelMid} opacity="0.6" />

      {/* LEDs on router 2 */}
      <circle cx={x + 2.5} cy={y + 4} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 4} cy={y + 4} r="0.4" fill={working ? C.fireHot : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 5.5} cy={y + 4} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />

      {/* router 3 (top) */}
      <rect x={x + 1} y={y} width="12" height="3" fill={C.metalDark} />
      <rect x={x + 2} y={y + 0.5} width="10" height="2" fill={C.steelMid} opacity="0.6" />

      {/* LEDs on router 3 */}
      <circle cx={x + 2.5} cy={y + 1} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 4} cy={y + 1} r="0.4" fill={working ? C.fireHot : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />
      <circle cx={x + 5.5} cy={y + 1} r="0.4" fill={working ? C.glassGreen : C.metalMid} className={working ? "anim-obj-glow-work" : ""} />

      {/* port rows */}
      <line x1={x + 10} y1={y + 6.5} x2={x + 11.5} y2={y + 6.5} stroke={C.metalMid} strokeWidth="0.5" />
      <line x1={x + 10} y1={y + 3.5} x2={x + 11.5} y2={y + 3.5} stroke={C.metalMid} strokeWidth="0.5" />
      <line x1={x + 10} y1={y + 0.5} x2={x + 11.5} y2={y + 0.5} stroke={C.metalMid} strokeWidth="0.5" />

      {/* cable spaghetti below */}
      <path d={`M ${x + 2} ${y + 9} Q ${x + 3} ${y + 10} ${x + 5} ${y + 9.5}`} stroke={C.metalMid} strokeWidth="0.8" fill="none" />
      <path d={`M ${x + 4} ${y + 9} Q ${x + 6} ${y + 10.5} ${x + 8} ${y + 9}`} stroke={C.metalMid} strokeWidth="0.8" fill="none" />
      <path d={`M ${x + 7} ${y + 9} Q ${x + 8.5} ${y + 10.2} ${x + 10} ${y + 9.5}`} stroke={C.metalMid} strokeWidth="0.8" fill="none" />
      <path d={`M ${x + 9} ${y + 9.5} Q ${x + 10.5} ${y + 10.5} ${x + 11} ${y + 9}`} stroke={C.metalMid} strokeWidth="0.8" fill="none" />

      {/* connectors at cable ends */}
      <circle cx={x + 5} cy={y + 9.5} r="0.4" fill={C.metalShine} />
      <circle cx={x + 8} cy={y + 9} r="0.4" fill={C.metalShine} />
      <circle cx={x + 10} cy={y + 9.5} r="0.4" fill={C.metalShine} />
      <circle cx={x + 11} cy={y + 9} r="0.4" fill={C.metalShine} />

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="14" height="10" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y} width="12" height="9" fill="none" stroke={C.glassCyan} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("RouterStack", RouterStack);
