import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const MechanicalCalc: ObjectComponent = ({ x, y, working, errored, active }) => {
  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 9} cy={y + 14} rx={7} ry={1.5} fill={C.shadow} opacity="0.3" />

      {/* main body */}
      <rect x={x} y={y} width="18" height="14" fill={C.metalBlack} />
      <rect x={x + 1} y={y + 1} width="16" height="12" fill={C.steelMid} opacity="0.7" />

      {/* display window (top) */}
      <rect x={x + 2} y={y + 1.5} width="14" height="2.5" fill={C.metalDark} strokeWidth="0.5" stroke={C.woodOutline} />
      <rect x={x + 3} y={y + 2} width="12" height="1.5" fill={working ? C.paper : C.velvetDeep} />

      {/* number display (scrolling tape) */}
      {working && (
        <>
          <text x={x + 4} y={y + 3} fontSize="1" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
            123456
          </text>
        </>
      )}

      {/* keyboard area (buttons grid) */}
      <g>
        {/* row 1 */}
        {[0, 3, 6, 9, 12].map((col, i) => (
          <g key={`r1-${i}`}>
            <rect x={x + 2.5 + col} y={y + 5} width="2.5" height="1.2" fill={C.metalMid} strokeWidth="0.3" stroke={C.woodOutline} />
            <text x={x + 3.2 + col} y={y + 5.7} fontSize="0.7" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
              {i + 1}
            </text>
          </g>
        ))}

        {/* row 2 */}
        {[0, 3, 6, 9, 12].map((col, i) => (
          <g key={`r2-${i}`}>
            <rect x={x + 2.5 + col} y={y + 6.5} width="2.5" height="1.2" fill={C.metalMid} strokeWidth="0.3" stroke={C.woodOutline} />
            <text x={x + 3.2 + col} y={y + 7.2} fontSize="0.7" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
              {i + 6}
            </text>
          </g>
        ))}

        {/* function buttons (right side) */}
        <rect x={x + 16} y={y + 5} width="1.5" height="1.2" fill={C.redAccent} strokeWidth="0.3" stroke={C.woodOutline} />
        <text x={x + 16.2} y={y + 5.7} fontSize="0.6" fontFamily="monospace" fill={C.paper} fontWeight="bold">
          +
        </text>

        <rect x={x + 16} y={y + 6.5} width="1.5" height="1.2" fill={C.fireHot} strokeWidth="0.3" stroke={C.woodOutline} />
        <text x={x + 16.2} y={y + 7.2} fontSize="0.6" fontFamily="monospace" fill={C.paper} fontWeight="bold">
          =
        </text>
      </g>

      {/* big lever (right side, mechanical) */}
      <rect x={x + 16.5} y={y + 8.5} width="1" height="3.5" fill={C.metalMid} />
      <circle cx={x + 17} cy={y + 8} r="0.5" fill={C.metalShine} />
      {working && (
        <g className="anim-char-walk">
          <line x1={x + 17} y1={y + 8.5} x2={x + 17} y2={y + 7} stroke={C.fireHot} strokeWidth="0.6" />
        </g>
      )}

      {/* paper tape output (bottom left) */}
      <rect x={x + 1} y={y + 11.5} width="8" height="1.5" fill={C.paper} />
      {working && (
        <text x={x + 2} y={y + 12.5} fontSize="0.6" fontFamily="monospace" fill={C.inkDark} opacity="0.6">
          ∙ ∙ ∙ ∙ ∙
        </text>
      )}

      {/* error indicator */}
      {errored && (
        <rect x={x} y={y} width="18" height="14" fill="none" stroke="#ff3a5e" strokeWidth="1" />
      )}

      {/* active glow */}
      {active && (
        <g className="anim-obj-pulse-active">
          <rect x={x + 1} y={y + 1} width="16" height="12" fill="none" stroke={C.glassAmber} strokeWidth="1" opacity="0.6" />
        </g>
      )}
    </g>
  );
};

registerObject("MechanicalCalc", MechanicalCalc);
