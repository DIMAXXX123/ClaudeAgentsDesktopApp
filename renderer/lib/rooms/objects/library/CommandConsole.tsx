import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const CommandConsole: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 15} cy={y + 13} rx={18} ry={2} fill={C.shadow} opacity="0.35" />
      {/* desk surface */}
      <rect x={x} y={y + 11} width="30" height="2" fill={C.woodMid} />
      <rect x={x} y={y + 11} width="30" height="1" fill={C.woodLight} opacity="0.5" />
      {/* legs */}
      <rect x={x + 2} y={y + 13} width="2" height="6" fill={C.woodDark} />
      <rect x={x + 26} y={y + 13} width="2" height="6" fill={C.woodDark} />
      {/* 3 CRT monitors */}
      {[0, 11, 22].map((offset) => (
        <g key={`crt-${offset}`}>
          <rect x={x + offset} y={y} width="9" height="10" fill={C.metalBlack} />
          <rect x={x + offset + 1} y={y + 1} width="7" height="8" fill={working ? color : C.crtBg} opacity={working ? 0.7 : 1} />
          {working && (
            <>
              <rect x={x + offset + 2} y={y + 2} width="5" height="0.5" fill="#fff" opacity="0.7" />
              <rect x={x + offset + 2} y={y + 4} width="4" height="0.5" fill="#fff" opacity="0.6" />
              <rect x={x + offset + 2} y={y + 6} width="5" height="0.5" fill="#fff" opacity="0.7" />
            </>
          )}
        </g>
      ))}
      {/* keyboard strip */}
      <rect x={x + 1} y={y + 9} width="28" height="1.5" fill={C.metalMid} />
      {/* key details */}
      {[2, 5, 8, 11, 14, 17, 20, 23, 26].map((kx) => (
        <rect key={`k-${kx}`} x={x + kx} y={y + 9.3} width="1.5" height="0.8" fill={C.metalBlack} />
      ))}
    </g>
  );
};

registerObject("CommandConsole", CommandConsole);
