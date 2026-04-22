import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CoinStack: ObjectComponent = ({ x, y, extra }) => {
  const stackHeight = (extra?.height as number) || 2;
  const coinSpacing = 1.2;

  return (
    <g>
      {/* shadow */}
      <ellipse cx={x + 4} cy={y + 8 + stackHeight * coinSpacing} rx={3.5} ry={1} fill={C.shadow} opacity="0.4" />

      {/* coins stacked */}
      {Array.from({ length: stackHeight }).map((_, i) => {
        const coinY = y + 8 - i * coinSpacing;
        return (
          <g key={i}>
            {/* coin ellipse (3D perspective) */}
            <ellipse cx={x + 4} cy={coinY} rx={3.5} ry={0.6} fill={C.goldDark} />
            <ellipse cx={x + 4} cy={coinY - 0.2} rx={3.5} ry={0.5} fill={C.gold} />
            <ellipse cx={x + 4} cy={coinY - 0.3} rx={3.3} ry={0.4} fill={C.goldHi} opacity="0.7" />

            {/* coin detail (top face only) */}
            {i === 0 && (
              <>
                <circle cx={x + 4} cy={coinY - 0.3} r={0.8} fill="none" stroke={C.goldDark} strokeWidth="0.2" />
                <text x={x + 2.8} y={coinY - 0.1} fontSize="0.8" fontFamily="monospace" fill={C.inkDark} fontWeight="bold">
                  $
                </text>
              </>
            )}
          </g>
        );
      })}
    </g>
  );
};

registerObject("CoinStack", CoinStack);
