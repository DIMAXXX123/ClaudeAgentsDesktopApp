import { NextRequest, NextResponse } from "next/server";
import { AGENTS } from "@/lib/agents";
import { THEMES } from "@/lib/rooms/themes";
import type { RoomDef, RoomObjectInstance, Scenario, CharacterAnim } from "@/lib/rooms/types";

const VALID_ANIMS: CharacterAnim[] = [
  "idle", "walk", "sit", "type", "hammer", "read", "cast",
  "aim", "count", "transmit", "swing", "brew", "stare",
];
function coerceAnim(a: unknown): CharacterAnim {
  return (VALID_ANIMS as string[]).includes(a as string) ? (a as CharacterAnim) : "stare";
}
import type { CustomAgent } from "@/lib/rooms/customAgents";

export const runtime = "nodejs";

const OBJECT_KINDS = [
  // Bridge set
  "CaptainChair",
  "HelmWheel",
  "CRTMonitor",
  "TacticalMap",
  "BrassCompass",
  "RadioTransmitter",
  "Periscope",
  "StarChart",
  "HoloTable",
  "CommandConsole",
  // Codex set
  "Bookshelf",
  "ReadingDesk",
  "Telescope",
  "Microscope",
  "Globe",
  "ScrollRack",
  "Herbarium",
  "InkwellQuill",
  "Candelabra",
  "Chalkboard",
  // Foundry set
  "Anvil",
  "Forge",
  "Workbench",
  "ToolRack",
  "BlueprintDesk",
  // War set
  "WeaponRack",
  "TrainingDummy",
  "BugBoard",
  "FlameSword",
  "MedicCabinet",
  "AmmoCrate",
  "PunchingBag",
  "BattleMap",
  "SignalMortar",
  "TacticalCRT",
  // Relay set
  "SatelliteDish",
  "ServerRack",
  "Oscilloscope",
  "PigeonCoop",
  "RouterStack",
  "AntennaArray",
  "CableSnake",
  "PhoneExchange",
  "BeaconLight",
  "ConsoleDesk",
  // Vault set
  "MegaSafe",
  "CoinStack",
  "TickerBoard",
  "BalanceScale",
  "GoldBars",
  "LedgerBook",
  "JeweledChest",
  "MechanicalCalc",
  "Abacus",
  // Decor set
  "Lantern",
  "Plant",
  "Rug",
  "WindowPane",
  "WallArt",
  "Cat",
  "CoffeeMug",
  "Clock",
  "FloorTile",
  "CeilingBeam",
  "NeonSign",
];

const ANIM_TYPES = [
  "idle",
  "walk",
  "sit",
  "type",
  "hammer",
  "read",
  "cast",
  "aim",
  "count",
  "transmit",
  "swing",
  "brew",
  "stare",
];

const THEME_KEYS = Object.keys(THEMES);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .substring(0, 20);
}

function generateUniqueAgentId(name: string): string {
  const base = slugify(name);
  let id = base;
  let counter = 1;

  // Check against static AGENTS
  while (AGENTS[id]) {
    id = `${base}${counter}`;
    counter++;
  }

  // Would also check custom agents in a real implementation,
  // but that would require async. Client will handle collision if needed.
  return id;
}

function createFallbackRoom(agentId: string, name: string, color: string): RoomDef {
  // Deterministic fallback if LLM fails
  const themeKey = THEME_KEYS[
    (agentId.charCodeAt(0) + agentId.charCodeAt(agentId.length - 1)) %
      THEME_KEYS.length
  ];
  const theme = THEMES[themeKey as keyof typeof THEMES];

  const objects: RoomObjectInstance[] = [
    { id: "obj1", kind: "Bookshelf", x: 10, y: 20, label: "Bookshelf" },
    { id: "obj2", kind: "Bookshelf", x: 30, y: 20, label: "Bookshelf" },
    { id: "obj3", kind: "Plant", x: 50, y: 25, label: "Plant" },
    { id: "obj4", kind: "Plant", x: 60, y: 25, label: "Plant" },
    { id: "obj5", kind: "Plant", x: 70, y: 25, label: "Plant" },
    { id: "obj6", kind: "Workbench", x: 90, y: 20, label: "Workbench" },
    { id: "obj7", kind: "Desk", x: 110, y: 22, label: "Desk" },
    { id: "obj8", kind: "Lantern", x: 130, y: 15, label: "Lantern" },
    { id: "obj9", kind: "Clock", x: 145, y: 18, label: "Clock" },
    { id: "obj10", kind: "Rug", x: 20, y: 50, label: "Rug" },
    { id: "obj11", kind: "WindowPane", x: 80, y: 10, label: "Window" },
    { id: "obj12", kind: "WallArt", x: 120, y: 15, label: "Picture" },
    { id: "obj13", kind: "CoffeeMug", x: 115, y: 30, label: "Mug" },
    { id: "obj14", kind: "Candelabra", x: 40, y: 35, label: "Candelabra" },
    { id: "obj15", kind: "Globe", x: 55, y: 35, label: "Globe" },
    { id: "obj16", kind: "ReadingDesk", x: 95, y: 35, label: "Reading Desk" },
    { id: "obj17", kind: "ToolRack", x: 30, y: 45, label: "Tools" },
    { id: "obj18", kind: "Chalkboard", x: 140, y: 35, label: "Board" },
    { id: "obj19", kind: "Cat", x: 70, y: 60, label: "Cat" },
    { id: "obj20", kind: "Telescope", x: 150, y: 20, label: "Telescope" },
  ];

  return {
    agentId,
    theme,
    character: {
      look: { shirt: color },
      home: { x: 78, y: 70 },
      face: 1,
    },
    objects,
  };
}

interface LLMRoomResponse {
  theme: string;
  objects: Array<{
    id: string;
    kind: string;
    x: number;
    y: number;
    label: string;
    scenarios?: Array<{
      id: string;
      label: string;
      anim: string;
      stand?: { x: number; y: number };
      face?: -1 | 1;
      duration?: number;
    }>;
  }>;
  character: {
    look?: Record<string, string>;
    home?: { x: number; y: number };
    face?: -1 | 1;
  };
}

async function callClaudOpus(
  name: string,
  role: string,
  vibe: string[],
): Promise<RoomDef | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_CODE_API_KEY;
  if (!apiKey) {
    console.error("No ANTHROPIC_API_KEY or CLAUDE_CODE_API_KEY set");
    return null;
  }

  const systemPrompt = `You are a pixel-art room designer. Design a room for an AI agent.
The room is 160 pixels wide and 96 pixels tall (viewBox).
Output must be valid JSON matching the provided schema.
- Pick an appropriate theme from: ${THEME_KEYS.join(", ")}.
- Place exactly 20 objects with unique ids (obj1..obj20).
- Object kinds available: ${OBJECT_KINDS.join(", ")}.
- X bounds: 2-155, Y bounds: 8-88 (non-overlapping).
- Each object needs a label and at least 1 scenario.
- Scenario animations: ${ANIM_TYPES.join(", ")}.
- Character home (idle spot) at Y 68-78 (floor level).
- Scenario stand positions should be near the object.
Return ONLY valid JSON, no extra text.`;

  const userPrompt = `Create a room for agent: "${name}" (role: "${role}"). Vibe: ${vibe.join(", ")}.
Return JSON matching this structure:
{
  "theme": "string (one of: ${THEME_KEYS.join(", ")})",
  "objects": [{"id":"obj1","kind":"...","x":number,"y":number,"label":"...","scenarios":[{"id":"s1","label":"...","anim":"...","stand":{"x":number,"y":number}}]}...],
  "character": {"look":{},"home":{"x":number,"y":number},"face":1}
}`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4000,
        messages: [
          {
            role: "user",
            content: userPrompt,
          },
        ],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Anthropic API error:", error);
      return null;
    }

    const data = (await response.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const content = data.content[0];
    if (content.type !== "text") {
      console.error("Unexpected response type:", content.type);
      return null;
    }

    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = content.text.trim();
    if (jsonStr.startsWith("```json")) {
      jsonStr = jsonStr.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    let parsed: LLMRoomResponse;
    try {
      parsed = JSON.parse(jsonStr) as LLMRoomResponse;
    } catch {
      console.error("[generate-room] LLM returned non-JSON content");
      return null;
    }

    // Validate and build RoomDef
    const themeKey = parsed.theme as keyof typeof THEMES;
    const theme = THEMES[themeKey] ?? THEMES.scholar;

    const objects: RoomObjectInstance[] = (parsed.objects ?? []).map((obj) => ({
      id: obj.id,
      kind: obj.kind,
      x: obj.x,
      y: obj.y,
      label: obj.label,
      scenarios: (obj.scenarios ?? []).map<Scenario>((s) => ({
        id: s.id,
        label: s.label,
        anim: coerceAnim(s.anim),
        stand: s.stand,
        face: s.face,
        duration: s.duration,
      })),
    }));

    // Ensure exactly 20 objects
    if (objects.length > 20) {
      objects.length = 20;
    } else {
      while (objects.length < 20) {
        objects.push({
          id: `obj${objects.length + 1}`,
          kind: "Plant",
          x: 20 + Math.random() * 120,
          y: 30 + Math.random() * 50,
          label: "Plant",
        });
      }
    }

    return {
      agentId: "", // Will be filled by caller
      theme,
      character: {
        look: parsed.character?.look ?? { shirt: "#ffffff" },
        home: parsed.character?.home ?? { x: 78, y: 70 },
        face: parsed.character?.face ?? 1,
      },
      objects,
    };
  } catch (e) {
    console.error("Error calling Claude Opus:", e);
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      name: string;
      role: string;
      color: string;
      vibe: string[];
    };

    const { name, role, color, vibe } = body;

    if (!name || !role || !color || !vibe || vibe.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const agentId = generateUniqueAgentId(name);

    // Try to get room from Claude, fall back to deterministic
    let roomDef =
      (await callClaudOpus(name, role, vibe)) ||
      createFallbackRoom(agentId, name, color);

    roomDef.agentId = agentId;

    // Create CustomAgent
    const agent: CustomAgent = {
      id: agentId,
      name: name.toUpperCase(),
      title: role,
      room: name,
      color,
      emoji: "🤖",
      greeting: `${name.toUpperCase()} online. What's the mission?`,
      description: `Custom agent: ${role}. Vibe: ${vibe.join(", ")}.`,
      systemPrompt: `You are ${name}, a ${role}. Vibe: ${vibe.join(", ")}. You operate inside ULTRONOS as a specialist agent.`,
      allowedTools: [
        "Bash",
        "Read",
        "Write",
        "Edit",
        "Grep",
        "Glob",
        "WebFetch",
        "WebSearch",
      ],
      custom: true,
      roomDef,
    };

    return NextResponse.json({
      agentId,
      agent,
    });
  } catch (e) {
    console.error("Error in generate-room:", e);
    return NextResponse.json(
      { error: `Failed to generate room: ${String(e)}` },
      { status: 500 },
    );
  }
}
