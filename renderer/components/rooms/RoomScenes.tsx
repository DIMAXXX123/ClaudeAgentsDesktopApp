"use client";

import { Room } from "./Room";
import { getRoomDef } from "@/lib/rooms/definitions";

interface RoomSceneProps {
  agentId: string;
  color: string;
  working: boolean;
  errored: boolean;
}

export function RoomScene({ agentId, color, working, errored }: RoomSceneProps) {
  const def = getRoomDef(agentId);
  return <Room def={def} color={color} working={working} errored={errored} />;
}
