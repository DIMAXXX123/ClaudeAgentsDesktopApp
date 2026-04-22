import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const WindowPane: ObjectComponent = ({ x, y, extra }) => {
  const width = (extra?.w as number) || 30;
  const height = (extra?.h as number) || 20;
  const timeOfDay = (extra?.time as string) || "day";

  const skyColor = timeOfDay === "dusk" ? C.skyDusk : timeOfDay === "night" ? C.skyNight : C.skyTop;
  const skyColor2 = timeOfDay === "dusk" ? C.skyPink : timeOfDay === "night" ? C.metalDark : C.skyMid;
  const sunColor = timeOfDay === "dusk" ? C.fireMid : timeOfDay === "night" ? C.metalMid : C.fireHot;

  return (
    <g>
      {/* frame */}
      <rect x={x} y={y} width={width} height={height} fill={C.woodDark} strokeWidth="1" stroke={C.woodOutline} />
      <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={C.woodMid} opacity="0.6" />

      {/* glass pane background (sky gradient simulation) */}
      <rect x={x + 2} y={y + 2} width={width - 4} height={height - 4} fill={skyColor} />
      <rect x={x + 2} y={y + height * 0.6} width={width - 4} height={height * 0.4 - 2} fill={skyColor2} opacity="0.6" />

      {/* sun/moon */}
      <circle cx={x + width * 0.75} cy={y + height * 0.3} r={2.5} fill={sunColor} opacity="0.8" />

      {/* cloud (day only) */}
      {timeOfDay === "day" && (
        <>
          <ellipse cx={x + width * 0.2} cy={y + height * 0.2} rx={2.5} ry={1.5} fill={C.paper} opacity="0.7" />
          <ellipse cx={x + width * 0.1} cy={y + height * 0.25} rx={1.5} ry={1} fill={C.paper} opacity="0.6" />
          <ellipse cx={x + width * 0.35} cy={y + height * 0.25} rx={2} ry={1} fill={C.paper} opacity="0.6" />
        </>
      )}

      {/* window panes (grid) */}
      <line x1={x + width * 0.5} y1={y + 2} x2={x + width * 0.5} y2={y + height - 2} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.6" />
      <line x1={x + 2} y1={y + height * 0.5} x2={x + width - 2} y2={y + height * 0.5} stroke={C.woodOutline} strokeWidth="0.5" opacity="0.6" />

      {/* glass shine effect */}
      <rect x={x + 2.5} y={y + 2.5} width={width * 0.4 - 3} height={height * 0.2 - 1} fill={C.metalHi} opacity="0.2" />

      {/* sill/frame depth */}
      <rect x={x} y={y + height - 1} width={width} height="1" fill={C.woodLight} opacity="0.5" />
    </g>
  );
};

registerObject("WindowPane", WindowPane);
