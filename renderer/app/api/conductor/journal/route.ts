import fsp from "node:fs/promises";
import { journalPath } from "@/lib/conductorFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const raw = await fsp.readFile(journalPath(), "utf8");
    return new Response(raw, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  } catch {
    return new Response("# Journal empty\n\nNo entries yet.\n", {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }
}
