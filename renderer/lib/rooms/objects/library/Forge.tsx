import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Forge: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 12} cy={y + 18} rx={14} ry={2} fill={C.shadow} opacity="0.35" />
      {/* brick structure */}
      <rect x={x} y={y + 6} width="24" height="12" fill={C.brickDark} />
      {/* brick pattern (4 rows of 6 bricks) */}
      {[0, 6, 12, 18].map((by) =>
        [0, 4, 8, 12, 16, 20].map((bx) => (
          <g key={`brick-${bx}-${by}`}>
            <rect x={x + bx} y={y + 6 + by} width="3.5" height="2.5" fill={C.brickMid} />
            <rect x={x + bx} y={y + 6 + by} width="3.5" height="1.2" fill={C.brickLight} opacity="0.4" />
          </g>
        ))
      )}
      {/* mortar lines */}
      {[6, 10, 14, 18].map((my) => (
        <line key={`mh-${my}`} x1={x} y1={y + my} x2={x + 24} y2={y + my} stroke={C.mortar} strokeWidth="0.3" />
      ))}
      {[4, 8, 12, 16, 20].map((mx) => (
        <line key={`mv-${mx}`} x1={x + mx} y1={y + 6} x2={x + mx} y2={y + 18} stroke={C.mortar} strokeWidth="0.3" />
      ))}
      {/* fire pit opening */}
      <rect x={x + 6} y={y + 10} width="12" height="8" fill={C.metalBlack} />
      {/* coals/embers */}
      {working && (
        <>
          <circle cx={x + 9} cy={y + 16} r="1" fill={C.fireHot} opacity="0.9" className="anim-spark-fly" />
          <circle cx={x + 12} cy={y + 15.5} r="0.8" fill={C.fireMid} opacity="0.8" className="anim-spark-fly" style={{ animationDelay: "0.2s" }} />
          <circle cx={x + 15} cy={y + 16} r="1.2" fill={C.fireHot} opacity="0.85" className="anim-spark-fly" style={{ animationDelay: "0.1s" }} />
          <circle cx={x + 10} cy={y + 14} r="0.9" fill={C.fireLow} opacity="0.8" className="anim-spark-fly" style={{ animationDelay: "0.3s" }} />
        </>
      )}
      {!working && (
        <>
          <circle cx={x + 9} cy={y + 16} r="1" fill={C.emberDeep} opacity="0.6" />
          <circle cx={x + 12} cy={y + 15.5} r="0.8" fill={C.fireLow} opacity="0.5" />
          <circle cx={x + 15} cy={y + 16} r="1.2" fill={C.emberDeep} opacity="0.6" />
        </>
      )}
      {/* bellows on left */}
      <ellipse cx={x + 2} cy={y + 14} rx={2} ry={3} fill={C.metalDark} />
      <ellipse cx={x + 2} cy={y + 14} rx={1.5} ry={2.5} fill={C.woodMid} opacity="0.7" />
      {/* bellows handle */}
      <rect x={x + 1} y={y + 11} width="2" height="1.5" fill={C.woodLight} />
    </g>
  );
};

registerObject("Forge", Forge);
