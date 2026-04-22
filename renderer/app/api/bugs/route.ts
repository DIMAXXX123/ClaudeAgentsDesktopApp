import { NextRequest } from "next/server";
import { listBugs, recordBug, unfixed } from "@/lib/bugCollector";

export const runtime = "nodejs";

export async function GET() {
  return Response.json({ bugs: listBugs(), unfixed: unfixed().length });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    source?: "client" | "server";
    kind?: "error" | "warn";
    message?: string;
    stack?: string;
  };
  recordBug({
    source: body.source ?? "client",
    kind: body.kind ?? "error",
    message: String(body.message ?? "").slice(0, 2000),
    stack: body.stack?.slice(0, 4000),
  });
  return Response.json({ ok: true });
}
