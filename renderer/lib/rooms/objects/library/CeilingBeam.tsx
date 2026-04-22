import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CeilingBeam: ObjectComponent = ({ x, y, extra }) => {
  const material = (extra?.material as string) || "wood";
  const yPos = (extra?.y as number) ?? y;

  const color1 = material === "metal" ? C.steelMid : C.woodDark;
  const color2 = material === "metal" ? C.steelLight : C.woodLight;

  return (
    <g>
      {/* main beam (long horizontal) */}
      <rect x={x} y={yPos} width="160" height="3" fill={color1} />
      <rect x={x} y={yPos} width="160" height="1.5" fill={color2} opacity="0.5" />

      {/* wood grain or metal rivets */}
      {material === "wood" ? (
        <>
          {/* grain lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={`grain-${i}`}
              x1={x + i * 20}
              y1={yPos + 0.5}
              x2={x + i * 20 + 15}
              y2={yPos + 0.5}
              stroke={C.woodOutline}
              strokeWidth="0.2"
              opacity="0.4"
            />
          ))}
        </>
      ) : (
        <>
          {/* rivets */}
          {Array.from({ length: 20 }).map((_, i) => (
            <circle
              key={`rivet-${i}`}
              cx={x + i * 8 + 4}
              cy={yPos + 1.5}
              r="0.4"
              fill={C.metalMid}
              opacity="0.7"
            />
          ))}
        </>
      )}

      {/* shadow underneath */}
      <rect x={x} y={yPos + 3} width="160" height="0.5" fill={C.shadow} opacity="0.2" />
    </g>
  );
};

registerObject("CeilingBeam", CeilingBeam);
