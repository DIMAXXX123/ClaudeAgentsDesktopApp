import { C } from "../palette";
import type { RoomTheme } from "../types";

export function RoomShell({
  id,
  theme,
}: {
  id: string;
  theme: RoomTheme;
}) {
  const { wallTop, wallHi, wallBot, floor, floorHi } = theme;
  return (
    <>
      <defs>
        <pattern id={`${id}-wall-upper`} width="24" height="6" patternUnits="userSpaceOnUse">
          <rect width="24" height="6" fill={wallTop} />
          <rect x="0" y="5" width="24" height="1" fill={C.woodOutline} opacity="0.5" />
          <rect x="0" y="0" width="1" height="6" fill={wallHi} />
          <rect x="8" y="0" width="1" height="6" fill={wallHi} opacity="0.4" />
        </pattern>
        <pattern id={`${id}-wainscot`} width="20" height="16" patternUnits="userSpaceOnUse">
          <rect width="20" height="16" fill={wallBot} />
          <rect x="1" y="1" width="18" height="14" fill={wallTop} opacity="0.55" />
          <rect x="1" y="1" width="18" height="1" fill={wallHi} />
          <rect x="1" y="14" width="18" height="1" fill={C.woodOutline} />
          <rect x="1" y="1" width="1" height="14" fill={wallHi} opacity="0.6" />
          <rect x="18" y="1" width="1" height="14" fill={C.woodOutline} />
        </pattern>
        <pattern id={`${id}-floor`} width="20" height="8" patternUnits="userSpaceOnUse">
          <rect width="20" height="8" fill={floor} />
          <rect x="0" y="7" width="20" height="1" fill={C.woodOutline} opacity="0.6" />
          <rect x="0" y="0" width="1" height="8" fill={floorHi} />
          <rect x="12" y="0" width="1" height="8" fill={floorHi} opacity="0.35" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="160" height="3" fill={theme.ceiling ?? C.woodOutline} />
      <rect x="0" y="3" width="160" height="1" fill={C.woodDark} />
      <rect x="0" y="4" width="160" height="40" fill={`url(#${id}-wall-upper)`} />
      <rect x="0" y="44" width="160" height="1" fill={wallHi} />
      <rect x="0" y="45" width="160" height="2" fill={C.woodOutline} />
      <rect x="0" y="47" width="160" height="16" fill={`url(#${id}-wainscot)`} />
      <rect x="0" y="63" width="160" height="1" fill={C.woodOutline} />
      <rect x="0" y="64" width="160" height="32" fill={`url(#${id}-floor)`} />
      <rect x="0" y="64" width="160" height="2" fill={C.shadow} opacity="0.3" />
      <rect x="0" y="64" width="12" height="32" fill={C.shadow} opacity="0.15" />
      <rect x="148" y="64" width="12" height="32" fill={C.shadow} opacity="0.15" />
      {theme.rimLight && (
        <>
          <rect x="0" y="4" width="2" height="40" fill={theme.rimLight} opacity="0.15" />
          <rect x="158" y="4" width="2" height="40" fill={theme.rimLight} opacity="0.15" />
        </>
      )}
    </>
  );
}

export function Shadow({
  cx,
  cy,
  rx = 8,
  ry = 2,
  opacity = 0.35,
}: {
  cx: number;
  cy: number;
  rx?: number;
  ry?: number;
  opacity?: number;
}) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={C.shadow} opacity={opacity} />;
}

export function LightPool({
  cx,
  cy,
  rx,
  ry,
  tone,
}: {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  tone: string;
}) {
  return (
    <>
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={tone} opacity="0.1" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.7} ry={ry * 0.7} fill={tone} opacity="0.12" />
      <ellipse cx={cx} cy={cy} rx={rx * 0.35} ry={ry * 0.4} fill={tone} opacity="0.14" />
    </>
  );
}

export function FramedArt({
  x,
  y,
  w,
  h,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  children?: React.ReactNode;
}) {
  return (
    <g>
      <rect x={x - 1} y={y + h} width={w + 2} height="1" fill={C.shadow} opacity="0.3" />
      <rect x={x} y={y} width={w} height={h} fill={C.goldDark} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={h - 2} fill={C.gold} />
      <rect x={x + 2} y={y + 2} width={w - 4} height={h - 4} fill={C.metalBlack} />
      <rect x={x} y={y} width={w} height="1" fill={C.goldHi} />
      <rect x={x} y={y + h - 1} width={w} height="1" fill={C.inkDark} />
      {children}
    </g>
  );
}
