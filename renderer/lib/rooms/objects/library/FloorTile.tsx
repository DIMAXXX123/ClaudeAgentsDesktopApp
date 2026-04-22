import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const FloorTile: ObjectComponent = ({ x, y, extra }) => {
  const variant = (extra?.variant as string) || "checkered";

  return (
    <g>
      {/* base tile strip */}
      <rect x={x} y={y} width="20" height="6" fill={C.floorMid} />

      {variant === "checkered" && (
        <>
          {/* checkered pattern */}
          {Array.from({ length: 5 }).map((_, i) =>
            Array.from({ length: 2 }).map((_, j) => {
              const isWhite = (i + j) % 2 === 0;
              return (
                <rect
                  key={`tile-${i}-${j}`}
                  x={x + i * 4}
                  y={y + j * 3}
                  width="4"
                  height="3"
                  fill={isWhite ? C.floorLight : C.floorDark}
                  opacity={isWhite ? 0.7 : 0.5}
                />
              );
            })
          )}
        </>
      )}

      {variant === "mosaic" && (
        <>
          {/* mosaic pattern (small rects) */}
          {Array.from({ length: 10 }).map((_, i) => (
            <rect
              key={`mosaic-${i}`}
              x={x + Math.random() * 15}
              y={y + Math.random() * 5}
              width="2"
              height="2"
              fill={[C.floorLight, C.floorDark, C.floorMid, C.woodMid][i % 4]}
              opacity="0.6"
            />
          ))}
        </>
      )}

      {variant === "geometric" && (
        <>
          {/* diagonal lines */}
          <line x1={x} y1={y} x2={x + 20} y2={y + 6} stroke={C.floorDark} strokeWidth="0.5" opacity="0.5" />
          <line x1={x} y1={y + 6} x2={x + 20} y2={y} stroke={C.floorDark} strokeWidth="0.5" opacity="0.5" />
          {/* cross pattern */}
          <line x1={x + 10} y1={y} x2={x + 10} y2={y + 6} stroke={C.floorLight} strokeWidth="0.4" opacity="0.4" />
        </>
      )}

      {/* border/edge highlight */}
      <rect x={x} y={y} width="20" height="6" fill="none" stroke={C.woodOutline} strokeWidth="0.5" opacity="0.4" />
    </g>
  );
};

registerObject("FloorTile", FloorTile);
