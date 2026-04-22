import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Bookshelf: ObjectComponent = ({ x, y, color, extra }) => {
  const variant = (extra?.variant as string) || "tall";
  const width = variant === "wide" ? 30 : 20;
  const height = variant === "wide" ? 20 : 30;

  return (
    <g>
      <ellipse cx={x + width / 2} cy={y + height - 1} rx={width / 2 + 1} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* frame */}
      <rect x={x} y={y} width={width} height={height} fill={C.woodDark} />
      {/* shelves */}
      {variant === "tall"
        ? [0, 8, 16, 24].map((yi) => (
            <g key={`shelf-${yi}`}>
              <rect x={x} y={y + yi} width={width} height="1" fill={C.woodMid} />
              <rect x={x} y={y + yi} width={width} height="0.4" fill={C.woodLight} opacity="0.5" />
            </g>
          ))
        : [0, 10].map((yi) => (
            <g key={`shelf-${yi}`}>
              <rect x={x} y={y + yi} width={width} height="1" fill={C.woodMid} />
              <rect x={x} y={y + yi} width={width} height="0.4" fill={C.woodLight} opacity="0.5" />
            </g>
          ))}
      {/* books as colored spines */}
      {[1, 4, 7, 11, 14, 17, 21, 24, 27].map((dy, i) => (
        <g key={`books-${i}`}>
          <rect x={x + 1} y={y + dy} width="2" height="5" fill={color} opacity="0.8" />
          <rect x={x + 4} y={y + dy} width="2" height="5" fill={C.redDeep} />
          <rect x={x + 7} y={y + dy} width="2" height="5" fill={C.goldDark} />
          <rect x={x + 10} y={y + dy} width="2" height="5" fill={C.velvetMid} />
          <rect x={x + 13} y={y + dy} width="2" height="5" fill={C.metalMid} opacity="0.7" />
          <rect x={x + 16} y={y + dy} width="2" height="5" fill={C.leavesDark} />
        </g>
      ))}
    </g>
  );
};

registerObject("Bookshelf", Bookshelf);
