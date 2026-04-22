import { registerObject } from "../registry";
import { C } from "../../palette";
import type { ObjectComponent } from "../../types";

export const RadioTransmitter: ObjectComponent = ({ x, y, color, working }) => {
  return (
    <g>
      <ellipse cx={x + 7} cy={y + 10} rx={8} ry={1.5} fill={C.shadow} opacity="0.35" />
      {/* case */}
      <rect x={x} y={y} width="14" height="10" fill={C.metalDark} />
      <rect x={x + 1} y={y + 1} width="12" height="8" fill={C.metalMid} />
      {/* antenna */}
      <rect x={x + 11} y={y - 8} width="1" height="8" fill={C.metalLight} />
      <rect x={x + 11.2} y={y - 9} width="0.6" height="1" fill={C.fireHot} />
      {/* knobs (3 dials) */}
      <circle cx={x + 3} cy={y + 4} r="1.5" fill={C.metalDark} stroke={C.gold} strokeWidth="0.2" />
      <rect x={x + 2.7} y={y + 2} width="0.6" height="1.5" fill={C.gold} />
      <circle cx={x + 7} cy={y + 4} r="1.5" fill={C.metalDark} stroke={C.gold} strokeWidth="0.2" />
      <rect x={x + 6.7} y={y + 2} width="0.6" height="1.5" fill={C.gold} />
      <circle cx={x + 11} cy={y + 4} r="1.5" fill={C.metalDark} stroke={C.gold} strokeWidth="0.2" />
      <rect x={x + 10.7} y={y + 2} width="0.6" height="1.5" fill={C.gold} />
      {/* indicator labels */}
      <text x={x + 3} y={y + 8} fontSize="1" textAnchor="middle" fill={C.gold} fontFamily="monospace">F</text>
      <text x={x + 7} y={y + 8} fontSize="1" textAnchor="middle" fill={C.gold} fontFamily="monospace">V</text>
      <text x={x + 11} y={y + 8} fontSize="1" textAnchor="middle" fill={C.gold} fontFamily="monospace">P</text>
      {/* status LED */}
      <circle cx={x + 2} cy={y + 1.5} r="0.8" fill={working ? "#ff3a5e" : C.metalDark} className={working ? "animate-pulse" : ""} />
    </g>
  );
};

registerObject("RadioTransmitter", RadioTransmitter);
