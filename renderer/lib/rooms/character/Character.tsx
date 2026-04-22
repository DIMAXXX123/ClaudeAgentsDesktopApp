import { SK, C } from "../palette";
import type { CharacterAnim, CharacterLook } from "../types";

type Props = {
  x: number;
  y: number;
  look: CharacterLook;
  anim: CharacterAnim;
  face?: -1 | 1;
};

const ACCESSORY_OFFSETS = {
  helmet: 0,
  hood: 0,
  goggles: 0,
  crown: 0,
  headset: 0,
  monocle: 0,
  beret: 0,
  none: 0,
} as const;

export function Character({ x, y, look, anim, face = 1 }: Props) {
  const skin = look.skin ?? SK.skin;
  const hair = look.hair ?? SK.hairBrown;
  const shirt = look.shirt ?? SK.shirt1;
  const pants = look.pants ?? SK.pants;
  const boot = look.boot ?? SK.boot;
  const eye = look.eye ?? SK.eyeDark;
  const accessory = look.accessory ?? "none";

  void ACCESSORY_OFFSETS;

  const seated = anim === "sit" || anim === "type" || anim === "read" || anim === "count" || anim === "transmit";
  const animClass =
    anim === "walk"
      ? "anim-char-walk"
      : anim === "hammer"
        ? "anim-char-hammer"
        : anim === "type"
          ? "anim-char-type"
          : anim === "read"
            ? "anim-char-read"
            : anim === "cast"
              ? "anim-char-cast"
              : anim === "aim"
                ? "anim-char-aim"
                : anim === "count"
                  ? "anim-char-count"
                  : anim === "transmit"
                    ? "anim-char-transmit"
                    : anim === "swing"
                      ? "anim-char-swing"
                      : anim === "brew"
                        ? "anim-char-brew"
                        : anim === "stare"
                          ? "anim-char-stare"
                          : anim === "sit"
                            ? undefined
                            : "anim-char-idle";

  const origin = `${x + 2}px ${y + 10}px`;
  const scaleX = face === -1 ? -1 : 1;

  return (
    <g
      className={animClass}
      style={{
        transformOrigin: origin,
        transform: scaleX === -1 ? `scale(-1, 1) translate(${-(2 * x + 4)}px, 0)` : undefined,
      }}
    >
      {/* head */}
      <rect x={x} y={y} width="5" height="5" fill={skin} />
      {/* hair cap */}
      <rect x={x} y={y} width="5" height="2" fill={hair} />
      <rect x={x - 1} y={y + 1} width="1" height="1" fill={hair} />
      <rect x={x + 5} y={y + 1} width="1" height="1" fill={hair} />
      {/* eyes */}
      <rect x={x + 1} y={y + 2} width="1" height="1" fill={eye} />
      <rect x={x + 3} y={y + 2} width="1" height="1" fill={eye} />
      {/* mouth */}
      <rect x={x + 2} y={y + 4} width="1" height="1" fill={SK.mouth} />
      {/* neck */}
      <rect x={x + 1} y={y + 5} width="3" height="1" fill={skin} />
      {/* torso */}
      <rect x={x - 1} y={y + 6} width="7" height="7" fill={shirt} />
      <rect x={x - 1} y={y + 6} width="7" height="1" fill="#fff" opacity="0.18" />
      <rect x={x - 1} y={y + 12} width="7" height="1" fill={SK.boot} opacity="0.6" />

      {seated ? (
        <>
          <rect x={x} y={y + 13} width="6" height="2" fill={pants} />
          <rect x={x + 1} y={y + 15} width="5" height="1" fill={boot} />
        </>
      ) : (
        <>
          <g className={anim === "walk" ? "anim-char-legs-walk" : undefined} style={{ transformOrigin: origin }}>
            <rect x={x} y={y + 13} width="2" height="5" fill={pants} />
            <rect x={x + 3} y={y + 13} width="2" height="5" fill={pants} />
            <rect x={x} y={y + 18} width="2" height="1" fill={boot} />
            <rect x={x + 3} y={y + 18} width="2" height="1" fill={boot} />
          </g>
        </>
      )}

      {/* Arms overlay — pose-dependent */}
      {renderArms(x, y, shirt, skin, anim)}

      {/* Accessory */}
      {renderAccessory(x, y, accessory, look)}
    </g>
  );
}

function renderArms(x: number, y: number, shirt: string, skin: string, anim: CharacterAnim) {
  if (anim === "hammer") {
    return (
      <g className="anim-char-arm-hammer" style={{ transformOrigin: `${x + 5}px ${y + 7}px` }}>
        <rect x={x + 5} y={y + 6} width="2" height="4" fill={shirt} />
        <rect x={x + 6} y={y + 10} width="1" height="2" fill={skin} />
        <rect x={x + 6} y={y + 12} width="3" height="1" fill="#1a1018" />
        <rect x={x + 7} y={y + 10} width="2" height="3" fill="#6a4a1a" />
      </g>
    );
  }
  if (anim === "type") {
    return (
      <g className="anim-char-arm-type">
        <rect x={x - 2} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x + 5} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x - 2} y={y + 10} width="1" height="1" fill={skin} />
        <rect x={x + 6} y={y + 10} width="1" height="1" fill={skin} />
      </g>
    );
  }
  if (anim === "read") {
    return (
      <g>
        <rect x={x - 2} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x + 5} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x - 3} y={y + 10} width="8" height="4" fill={C.paper} />
        <rect x={x - 3} y={y + 10} width="8" height="1" fill={C.paperShade} />
        <rect x={x + 1} y={y + 10} width="1" height="4" fill={C.paperShade} />
        <rect x={x - 2} y={y + 11} width="2" height="1" fill={C.inkDark} opacity="0.7" />
        <rect x={x + 2} y={y + 11} width="2" height="1" fill={C.inkDark} opacity="0.7" />
        <rect x={x - 2} y={y + 12} width="3" height="1" fill={C.inkDark} opacity="0.5" />
      </g>
    );
  }
  if (anim === "cast" || anim === "transmit") {
    return (
      <g className="anim-char-arm-cast" style={{ transformOrigin: `${x + 5}px ${y + 7}px` }}>
        <rect x={x + 5} y={y + 5} width="2" height="4" fill={shirt} />
        <rect x={x + 6} y={y + 4} width="1" height="2" fill={skin} />
        <rect x={x + 6} y={y + 2} width="1" height="3" fill={C.gold} opacity="0.85" />
      </g>
    );
  }
  if (anim === "aim" || anim === "swing") {
    return (
      <g className={anim === "swing" ? "anim-char-arm-swing" : undefined} style={{ transformOrigin: `${x + 5}px ${y + 7}px` }}>
        <rect x={x + 5} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x + 7} y={y + 7} width="5" height="1" fill={C.metalLight} />
        <rect x={x + 7} y={y + 7} width="5" height="1" fill={C.metalShine} opacity="0.4" />
        <rect x={x + 11} y={y + 7} width="1" height="1" fill={C.fireHot} opacity="0.7" />
      </g>
    );
  }
  if (anim === "count") {
    return (
      <g className="anim-char-arm-count">
        <rect x={x - 2} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x + 5} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x - 2} y={y + 10} width="1" height="1" fill={skin} />
        <rect x={x + 6} y={y + 10} width="1" height="1" fill={skin} />
        <rect x={x - 1} y={y + 11} width="1" height="1" fill={C.gold} />
        <rect x={x + 5} y={y + 11} width="1" height="1" fill={C.gold} />
      </g>
    );
  }
  if (anim === "brew") {
    return (
      <g>
        <rect x={x + 5} y={y + 7} width="2" height="3" fill={shirt} />
        <rect x={x + 6} y={y + 10} width="1" height="1" fill={skin} />
      </g>
    );
  }
  if (anim === "stare") {
    return (
      <g>
        <rect x={x - 2} y={y + 7} width="2" height="4" fill={shirt} />
        <rect x={x + 5} y={y + 7} width="2" height="4" fill={shirt} />
      </g>
    );
  }
  // idle / walk / sit
  if (anim === "walk") {
    return (
      <g className="anim-char-arm-walk" style={{ transformOrigin: `${x + 2}px ${y + 8}px` }}>
        <rect x={x - 2} y={y + 7} width="2" height="4" fill={shirt} />
        <rect x={x + 5} y={y + 7} width="2" height="4" fill={shirt} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x - 2} y={y + 7} width="2" height="4" fill={shirt} />
      <rect x={x + 5} y={y + 7} width="2" height="4" fill={shirt} />
    </g>
  );
}

function renderAccessory(x: number, y: number, accessory: NonNullable<CharacterLook["accessory"]>, look: CharacterLook) {
  if (accessory === "helmet") {
    return (
      <g>
        <rect x={x - 1} y={y - 1} width="7" height="3" fill={C.metalDark} />
        <rect x={x - 1} y={y - 1} width="7" height="1" fill={C.metalHi} />
        <rect x={x + 2} y={y - 2} width="1" height="1" fill={C.redAccent} />
      </g>
    );
  }
  if (accessory === "hood") {
    return (
      <g>
        <rect x={x - 1} y={y - 1} width="7" height="3" fill={look.hair ?? SK.hairBlack} />
        <rect x={x - 2} y={y + 1} width="1" height="4" fill={look.hair ?? SK.hairBlack} />
        <rect x={x + 6} y={y + 1} width="1" height="4" fill={look.hair ?? SK.hairBlack} />
      </g>
    );
  }
  if (accessory === "goggles") {
    return (
      <g>
        <rect x={x} y={y + 2} width="2" height="1" fill={C.metalDark} />
        <rect x={x + 3} y={y + 2} width="2" height="1" fill={C.metalDark} />
        <rect x={x + 2} y={y + 2} width="1" height="1" fill={C.metalDark} />
      </g>
    );
  }
  if (accessory === "crown") {
    return (
      <g>
        <rect x={x} y={y - 1} width="5" height="1" fill={C.gold} />
        <rect x={x} y={y - 2} width="1" height="1" fill={C.gold} />
        <rect x={x + 2} y={y - 2} width="1" height="1" fill={C.gold} />
        <rect x={x + 4} y={y - 2} width="1" height="1" fill={C.gold} />
      </g>
    );
  }
  if (accessory === "headset") {
    return (
      <g>
        <rect x={x} y={y - 1} width="5" height="1" fill={C.metalDark} />
        <rect x={x - 1} y={y} width="1" height="3" fill={C.metalDark} />
        <rect x={x + 5} y={y} width="1" height="3" fill={C.metalDark} />
        <rect x={x + 5} y={y + 1} width="1" height="1" fill={C.fireHot} opacity="0.8" />
      </g>
    );
  }
  if (accessory === "monocle") {
    return (
      <g>
        <rect x={x + 3} y={y + 1} width="2" height="1" fill={C.gold} />
        <rect x={x + 3} y={y + 3} width="2" height="1" fill={C.gold} />
        <rect x={x + 3} y={y + 2} width="1" height="1" fill={C.gold} />
        <rect x={x + 4} y={y + 2} width="1" height="1" fill={C.gold} />
      </g>
    );
  }
  if (accessory === "beret") {
    return (
      <g>
        <rect x={x - 1} y={y - 1} width="7" height="2" fill={SK.hairBlack} />
        <rect x={x + 4} y={y - 2} width="1" height="1" fill={C.redAccent} />
      </g>
    );
  }
  return null;
}
