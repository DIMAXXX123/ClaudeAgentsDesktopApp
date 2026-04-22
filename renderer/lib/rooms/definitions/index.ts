import type { RoomDef } from "../types";
import { ultron } from "./ultron";
import { nova } from "./nova";
import { forge } from "./forge";
import { ares } from "./ares";
import { echo } from "./echo";
import { midas } from "./midas";

export const ROOM_DEFINITIONS: Record<string, RoomDef> = {
  ultron,
  nova,
  forge,
  ares,
  echo,
  midas,
};

export function getRoomDef(agentId: string): RoomDef {
  // Check static definitions first
  if (ROOM_DEFINITIONS[agentId]) {
    return ROOM_DEFINITIONS[agentId];
  }

  // Try to load custom agent from localStorage (client-side only)
  if (typeof window !== "undefined") {
    try {
      const { loadCustomAgents } = require("../customAgents");
      const custom = loadCustomAgents().find(
        (a: { id: string }) => a.id === agentId,
      );
      if (custom && custom.roomDef) {
        return custom.roomDef;
      }
    } catch {
      // Module not available or error loading, ignore
    }
  }

  // Fallback to ultron
  return ROOM_DEFINITIONS.ultron;
}
