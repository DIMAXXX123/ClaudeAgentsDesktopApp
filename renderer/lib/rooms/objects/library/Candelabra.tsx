import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Candelabra: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 4} cy={y + 16} rx={5} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* base */}
      <ellipse cx={x + 4} cy={y + 14} rx={4} ry={1.5} fill={C.gold} />
      <ellipse cx={x + 4} cy={y + 14} rx={3.5} ry={1} fill={C.metalMid} />
      {/* center column */}
      <rect x={x + 3.3} y={y + 4} width="1.4" height="10" fill={C.gold} />
      <rect x={x + 3.5} y={y + 4} width="1" height="10" fill={C.metalLight} opacity="0.4" />
      {/* candle arms (3 branches) */}
      {[0, 1, 2].map((i) => {
        const angle = (i - 1) * 35;
        const armX = x + 4 + Math.cos((angle * Math.PI) / 180) * 2.5;
        const armY = y + 5 + Math.sin((angle * Math.PI) / 180) * 2;
        return (
          <g key={`arm-${i}`}>
            <line x1={x + 4} y1={y + 6} x2={armX} y2={armY} stroke={C.gold} strokeWidth="0.4" />
            {/* candle holder */}
            <circle cx={armX} cy={armY - 0.5} r="0.8" fill={C.gold} />
            {/* candle (wax) */}
            <rect x={armX - 0.5} y={armY - 3} width="1" height="2.5" fill={C.paper} />
            {/* flame */}
            {working ? (
              <>
                <polygon points={`${armX},${armY - 3.5} ${armX - 0.4},${armY - 2} ${armX + 0.4},${armY - 2}`} fill={C.fireHot} className="animate-pulse" />
                <polygon points={`${armX},${armY - 3} ${armX - 0.2},${armY - 2} ${armX + 0.2},${armY - 2}`} fill={C.fireMid} opacity="0.8" />
              </>
            ) : (
              <polygon points={`${armX},${armY - 3} ${armX - 0.2},${armY - 2} ${armX + 0.2},${armY - 2}`} fill={C.fireHot} />
            )}
          </g>
        );
      })}
    </g>
  );
};

registerObject("Candelabra", Candelabra);
