"use client";

import { useState } from "react";
import type { RoomDef } from "@/lib/rooms/types";
import { RoomShell } from "@/lib/rooms/objects/primitives";
import { Character } from "@/lib/rooms/character/Character";
import { useScenarioController } from "@/lib/rooms/scenarios/engine";
import { RoomObject } from "./RoomObject";
import { RoomTooltip } from "./RoomTooltip";
import { C } from "@/lib/rooms/palette";

interface RoomProps {
  def: RoomDef;
  color: string;
  working: boolean;
  errored: boolean;
}

export function Room({ def, color, working, errored }: RoomProps) {
  const [hoveredObjectId, setHoveredObjectId] = useState<string | null>(null);

  const engine = useScenarioController(def, working);

  const glow = errored ? "#ff3a5e" : color;

  // Sort objects by layer and z-order
  const sortedObjects = [...def.objects].sort((a, b) => {
    const layerOrder = { wall: 0, floor: 1, foreground: 2 };
    const layerA = layerOrder[a.layer ?? "floor"] ?? 1;
    const layerB = layerOrder[b.layer ?? "floor"] ?? 1;

    if (layerA !== layerB) return layerA - layerB;

    // Within same layer, sort by z (or y as fallback)
    const zA = a.z ?? a.y;
    const zB = b.z ?? b.y;
    return zA - zB;
  });

  // Get tooltip text
  const hoveredObject = hoveredObjectId ? def.objects.find((o) => o.id === hoveredObjectId) : null;
  const tooltipLabel = hoveredObject?.label ?? hoveredObject?.kind ?? null;
  const isActiveObject = engine.activeObjectId === hoveredObjectId;
  const tooltipScenarioLabel = isActiveObject ? engine.activeScenario?.label : null;

  return (
    <div
      className="relative z-0 w-full overflow-hidden rounded-[3px] border-2"
      style={{
        aspectRatio: "5 / 3",
        borderColor: glow,
        background: C.metalBlack,
        boxShadow: `inset 0 0 0 1px ${C.woodOutline}, inset 0 0 14px ${glow}33, 0 0 0 1px #000`,
      }}
    >
      <svg
        viewBox="0 0 160 96"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="crispEdges"
        className="absolute inset-0 h-full w-full room-stage"
      >
        {/* Backdrop */}
        {def.backdrop}

        {/* Room shell */}
        <RoomShell id={def.agentId} theme={def.theme} />

        {/* Render objects by layer */}
        {sortedObjects.map((obj) => (
          <RoomObject
            key={obj.id}
            obj={obj}
            color={color}
            working={working}
            errored={errored}
            active={engine.activeObjectId === obj.id}
            onFocus={engine.focus}
            onHover={setHoveredObjectId}
          />
        ))}

        {/* Character */}
        <Character
          x={Math.round(engine.characterPos.x)}
          y={Math.round(engine.characterPos.y)}
          look={def.character.look}
          anim={engine.characterAnim}
          face={engine.characterFace}
        />

        {/* Foreground FX */}
        {def.foregroundFx}

        {/* Vignette corners */}
        <rect x="0" y="0" width="4" height="96" fill={C.shadow} opacity="0.25" />
        <rect x="156" y="0" width="4" height="96" fill={C.shadow} opacity="0.25" />
        <rect x="0" y="92" width="160" height="4" fill={C.shadow} opacity="0.3" />
      </svg>

      {/* Scan line overlay when working */}
      {working && (
        <div
          className="pointer-events-none absolute inset-x-0 h-[2px] animate-scan"
          style={{ background: `linear-gradient(90deg, transparent, ${glow}, transparent)` }}
        />
      )}

      {/* Error pulse overlay */}
      {errored && (
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-red-500/10" />
      )}

      {/* Tooltip */}
      <RoomTooltip label={tooltipLabel} scenarioLabel={tooltipScenarioLabel} />
    </div>
  );
}
