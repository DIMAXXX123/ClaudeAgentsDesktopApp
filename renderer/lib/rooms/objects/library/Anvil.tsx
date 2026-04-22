import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Anvil: ObjectComponent = ({ x, y, color, active }) => {
  return (
    <g>
      <ellipse cx={x + 7} cy={y + 10} rx={8} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* wood block base */}
      <rect x={x} y={y + 8} width="14" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 10} width="14" height="1" fill={C.woodOutline} />
      {/* anvil body (main mass) */}
      <rect x={x + 2} y={y + 3} width="10" height="4" fill={C.metalDark} />
      <rect x={x + 1} y={y + 4} width="12" height="2" fill={C.metalMid} />
      <rect x={x + 2} y={y + 3} width="10" height="1" fill={C.metalLight} opacity="0.4" />
      {/* horn (pointed side) */}
      <polygon points={`${x + 12},${y + 5} ${x + 14},${y + 6} ${x + 12},${y + 7}`} fill={C.metalDark} />
      {/* striking surface depression */}
      <rect x={x + 3} y={y + 3} width="8" height="0.8" fill={C.metalBlack} opacity="0.6" />
      {/* face at bottom */}
      <rect x={x + 2} y={y + 6.5} width="10" height="1.5" fill={C.metalMid} />
      <rect x={x + 2} y={y + 6.5} width="10" height="0.5" fill={C.metalLight} opacity="0.3" />
      {/* sparks when active */}
      {active && (
        <>
          <rect x={x + 5} y={y + 0.5} width="1" height="1" fill={C.fireHot} className="anim-spark-fly" />
          <rect x={x + 7} y={y + 1.5} width="0.8" height="0.8" fill={C.fireMid} className="anim-spark-fly" style={{ animationDelay: "0.15s" }} />
          <rect x={x + 9} y={y + 1} width="0.6" height="0.6" fill={C.fireHot} className="anim-spark-fly" style={{ animationDelay: "0.3s" }} />
        </>
      )}
    </g>
  );
};

registerObject("Anvil", Anvil);
