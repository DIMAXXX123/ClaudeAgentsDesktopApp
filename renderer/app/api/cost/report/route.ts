import { NextRequest, NextResponse } from 'next/server';
import Database from 'better-sqlite3';
import { join } from 'path';
import { homedir } from 'os';
import { existsSync } from 'fs';

const dbPath = join(homedir(), '.claude', 'cost-tracker.db');

interface CostReport {
  totals: {
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
  };
  byModel: Array<{ model: string; calls: number; tokensIn: number; tokensOut: number; costUsd: number }>;
  byDay: Array<{ date: string; costUsd: number }>;
  topTasks: Array<{ task: string; costUsd: number; calls: number }>;
}

export async function GET(request: NextRequest) {
  try {
    if (!existsSync(dbPath)) {
      return NextResponse.json<CostReport>(
        {
          totals: { tokensIn: 0, tokensOut: 0, costUsd: 0 },
          byModel: [],
          byDay: [],
          topTasks: [],
        },
        { status: 200 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const days = parseInt(searchParams.get('days') ?? '7', 10);

    const db = new Database(dbPath);

    // Calculate since date
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    const sinceISO = sinceDate.toISOString().split('T')[0] + 'T00:00:00';

    // Total costs
    const totals = db.prepare(`
      SELECT
        SUM(in_tokens) as tokensIn,
        SUM(out_tokens) as tokensOut,
        SUM(cost) as costUsd
      FROM usage
      WHERE ts >= ?
    `).get(sinceISO) as { tokensIn: number | null; tokensOut: number | null; costUsd: number | null };

    // By model
    const byModel = db.prepare(`
      SELECT
        model,
        COUNT(*) as calls,
        SUM(in_tokens) as tokensIn,
        SUM(out_tokens) as tokensOut,
        SUM(cost) as costUsd
      FROM usage
      WHERE ts >= ?
      GROUP BY model
      ORDER BY costUsd DESC
    `).all(sinceISO) as Array<{
      model: string;
      calls: number;
      tokensIn: number | null;
      tokensOut: number | null;
      costUsd: number | null;
    }>;

    // By day
    const byDay = db.prepare(`
      SELECT
        DATE(ts) as date,
        SUM(cost) as costUsd
      FROM usage
      WHERE ts >= ?
      GROUP BY DATE(ts)
      ORDER BY date ASC
    `).all(sinceISO) as Array<{ date: string; costUsd: number | null }>;

    // Top tasks
    const topTasks = db.prepare(`
      SELECT
        task,
        SUM(cost) as costUsd,
        COUNT(*) as calls
      FROM usage
      WHERE ts >= ? AND task IS NOT NULL AND task != ''
      GROUP BY task
      ORDER BY costUsd DESC
      LIMIT 5
    `).all(sinceISO) as Array<{ task: string; costUsd: number | null; calls: number }>;

    db.close();

    const response: CostReport = {
      totals: {
        tokensIn: totals?.tokensIn ?? 0,
        tokensOut: totals?.tokensOut ?? 0,
        costUsd: parseFloat((totals?.costUsd ?? 0).toFixed(4)),
      },
      byModel: byModel.map(m => ({
        model: m.model,
        calls: m.calls,
        tokensIn: m.tokensIn ?? 0,
        tokensOut: m.tokensOut ?? 0,
        costUsd: parseFloat((m.costUsd ?? 0).toFixed(4)),
      })),
      byDay: byDay.map(d => ({
        date: d.date,
        costUsd: parseFloat((d.costUsd ?? 0).toFixed(4)),
      })),
      topTasks: topTasks.map(t => ({
        task: t.task,
        costUsd: parseFloat((t.costUsd ?? 0).toFixed(4)),
        calls: t.calls,
      })),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/cost/report]', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost report', details: String(error) },
      { status: 500 }
    );
  }
}
