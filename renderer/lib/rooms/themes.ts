import { C } from "./palette";
import type { RoomTheme } from "./types";

export const THEMES = {
  bridge: {
    id: "bridge",
    ambient: "bridge-night",
    wallTop: "#2a3a5a",
    wallHi: "#5a7aa8",
    wallBot: "#1a2340",
    floor: "#2a3652",
    floorHi: "#4a5a7a",
    rimLight: "#22e8ff",
  },
  scholar: {
    id: "scholar",
    ambient: "scholar-dusk",
    wallTop: C.woodMidWarm,
    wallHi: C.woodLight,
    wallBot: C.woodDark,
    floor: C.floorMid,
    floorHi: C.floorLight,
    rimLight: "#22ff88",
  },
  smith: {
    id: "smith",
    ambient: "forge-red",
    wallTop: C.brickMid,
    wallHi: C.brickLight,
    wallBot: C.brickDark,
    floor: "#3a2416",
    floorHi: "#5a3a22",
    rimLight: "#ffae3a",
  },
  warrior: {
    id: "warrior",
    ambient: "war-alert",
    wallTop: "#3a1a3a",
    wallHi: "#6a2a6a",
    wallBot: "#200818",
    floor: "#1a0a14",
    floorHi: "#3a1828",
    rimLight: "#ff4adf",
  },
  relay: {
    id: "relay",
    ambient: "relay-cyan",
    wallTop: "#1a3040",
    wallHi: "#2a6080",
    wallBot: "#0a1a28",
    floor: "#0a2030",
    floorHi: "#2a4a60",
    rimLight: "#06b6d4",
  },
  quant: {
    id: "quant",
    ambient: "vault-gold",
    wallTop: "#4a3a18",
    wallHi: "#7a5a28",
    wallBot: "#2a1a08",
    floor: "#3a2a10",
    floorHi: "#5a4218",
    rimLight: "#f5d64a",
  },
  lab: {
    id: "lab",
    ambient: "lab-green",
    wallTop: "#1a3a2a",
    wallHi: "#2a6a4a",
    wallBot: "#0a1a14",
    floor: "#0a2a1a",
    floorHi: "#2a4a38",
    rimLight: "#22ff88",
  },
  void: {
    id: "void",
    ambient: "void",
    wallTop: "#14142a",
    wallHi: "#2a2a4a",
    wallBot: "#08081a",
    floor: "#0a0a20",
    floorHi: "#1a1a38",
    rimLight: "#8a5aff",
  },
} as const satisfies Record<string, RoomTheme>;

export type ThemeKey = keyof typeof THEMES;

export function themeById(id: string): RoomTheme {
  return (THEMES as Record<string, RoomTheme>)[id] ?? THEMES.scholar;
}
