import type { ReactNode } from "react";

export type WorkState = "idle" | "working" | "errored";

export type CharacterAnim =
  | "idle"
  | "walk"
  | "sit"
  | "type"
  | "hammer"
  | "read"
  | "cast"
  | "aim"
  | "count"
  | "transmit"
  | "swing"
  | "brew"
  | "stare";

export type CharacterLook = {
  skin?: string;
  hair?: string;
  shirt?: string;
  pants?: string;
  boot?: string;
  eye?: string;
  accessory?: "helmet" | "hood" | "goggles" | "crown" | "headset" | "monocle" | "beret" | "none";
};

export type Scenario = {
  id: string;
  /** Label shown in tooltip when this scenario triggers */
  label: string;
  /** Character animation while this scenario is active */
  anim: CharacterAnim;
  /** Where the character stands (or sits) for this scenario. Defaults to the object's own anchor. */
  stand?: { x: number; y: number };
  /** Which direction the character faces: -1 left, 1 right */
  face?: -1 | 1;
  /** How long scenario plays, in seconds. Default 4. */
  duration?: number;
  /** Extra overlay drawn on top of the object while active (e.g., sparks, glow) */
  overlayKey?: string;
};

export type RoomObjectInstance = {
  /** Unique id within room */
  id: string;
  /** Registry key — maps to a component in OBJECT_REGISTRY */
  kind: string;
  /** Top-left position in the 160×96 viewBox */
  x: number;
  y: number;
  /** Paint layer: wall items (behind person), floor items (in front of walls, behind person),
   *  foreground (in front of person at same row). Default "floor". */
  layer?: "wall" | "floor" | "foreground";
  /** Vertical sort index within its layer. Higher = drawn later. Auto-derived from y if missing. */
  z?: number;
  /** Arbitrary props forwarded to the object component */
  props?: Record<string, unknown>;
  /** Whether this object is interactive (clickable + rotatable). Defaults true. */
  interactive?: boolean;
  /** Tooltip shown on hover (short label). Falls back to object kind. */
  label?: string;
  /** One or more scenarios — the scenario engine picks among them while the agent is working. */
  scenarios?: Scenario[];
};

export type RoomTheme = {
  id: string;
  /** CSS-rendered background below the scene (gradient, starfield, etc.) */
  ambient?: "warm-tavern" | "bridge-night" | "scholar-dusk" | "forge-red" | "war-alert" | "relay-cyan" | "vault-gold" | "void" | "lab-green";
  wallTop: string;
  wallHi: string;
  wallBot: string;
  floor: string;
  floorHi: string;
  /** Optional extra ceiling color, defaults to outline */
  ceiling?: string;
  /** Rim light tint — used for subtle color wash on walls */
  rimLight?: string;
};

export type RoomDef = {
  agentId: string;
  theme: RoomTheme;
  character: {
    look: CharacterLook;
    /** Default resting spot (idle position) */
    home: { x: number; y: number };
    /** Facing direction when idle (-1 left, 1 right). Default 1. */
    face?: -1 | 1;
  };
  /** Decorative static background drawn BEFORE the RoomShell (sky through windows, nebula, etc.) */
  backdrop?: ReactNode;
  /** Decorative static foreground drawn AFTER all objects but BEFORE character (fog, sparks) */
  foregroundFx?: ReactNode;
  /** 20 interactive objects that make up the room */
  objects: RoomObjectInstance[];
};

export type ObjectComponentProps = {
  x: number;
  y: number;
  color: string;
  working: boolean;
  errored: boolean;
  /** True when this specific object is the active scenario target. */
  active?: boolean;
  /** Whatever extra props the object registers. */
  extra?: Record<string, unknown>;
};

export type ObjectComponent = (props: ObjectComponentProps) => ReactNode;
