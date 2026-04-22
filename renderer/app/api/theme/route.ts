import { NextResponse } from "next/server";
import type { ThemeId } from "@/lib/theme/themes";
import { THEMES, DEFAULT_THEME } from "@/lib/theme/themes";

// Simple in-memory store for SSR context (client localStorage is the source of truth)
let _serverTheme: ThemeId = DEFAULT_THEME;

export async function GET() {
  return NextResponse.json({
    theme: _serverTheme,
    available: Object.keys(THEMES) as ThemeId[],
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("theme" in body) ||
    typeof (body as Record<string, unknown>).theme !== "string"
  ) {
    return NextResponse.json({ error: "Missing 'theme' field" }, { status: 400 });
  }

  const requested = (body as { theme: string }).theme as ThemeId;

  if (!(requested in THEMES)) {
    return NextResponse.json(
      { error: `Unknown theme '${requested}'. Available: ${Object.keys(THEMES).join(", ")}` },
      { status: 400 },
    );
  }

  _serverTheme = requested;

  return NextResponse.json({ theme: _serverTheme });
}
