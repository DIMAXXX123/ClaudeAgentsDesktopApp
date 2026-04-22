import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const Rug: ObjectComponent = ({ x, y, extra }) => {
  const width = (extra?.w as number) || 40;
  const height = (extra?.h as number) || 8;
  const mainColor = (extra?.main as string) || C.redMid;
  const trimColor = (extra?.trim as string) || C.goldDark;

  return (
    <g>
      {/* main rug */}
      <rect x={x} y={y} width={width} height={height} fill={mainColor} opacity="0.85" />

      {/* pattern (simple stripes) */}
      {Array.from({ length: Math.floor(width / 4) }).map((_, i) => (
        <rect key={i} x={x + i * 4 + 1} y={y + 1} width="1.5" height={height - 2} fill={trimColor} opacity="0.4" />
      ))}

      {/* trim border (all sides) */}
      <rect x={x} y={y} width={width} height={height} fill="none" stroke={trimColor} strokeWidth="1" />
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill="none" stroke={trimColor} strokeWidth="0.5" opacity="0.6" />

      {/* shadow underneath */}
      <rect x={x + 0.5} y={y + height - 0.5} width={width - 1} height="0.3" fill={C.shadow} opacity="0.2" />
    </g>
  );
};

registerObject("Rug", Rug);
