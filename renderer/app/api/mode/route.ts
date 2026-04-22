import { NextRequest, NextResponse } from 'next/server';

const DEFAULT_CONFIG = {
  id: 'autopilot' as const,
  label: 'Autopilot',
  icon: '✈️',
  plannerModel: 'claude-sonnet-4.6',
  workerModel: 'claude-sonnet-4.6',
  maxParallel: 3,
  description: 'Balanced, default mode',
};

export async function GET() {
  return NextResponse.json({ mode: 'autopilot', config: DEFAULT_CONFIG });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { mode?: unknown };
    if (typeof body.mode !== 'string') {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    return NextResponse.json({ mode: body.mode, config: { ...DEFAULT_CONFIG, id: body.mode } });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
