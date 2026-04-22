import { NextRequest } from "next/server";
import type { AgentId, Plan, Slot } from "@/lib/conductor";
import { AGENT_IDS, DEFAULTS, PILLARS } from "@/lib/conductor";
import { buildAllBriefs } from "@/lib/conductorBriefs";
import {
  ensureDirs,
  planPath,
  readPlan,
  resolveProjectRoot,
  writePlan,
} from "@/lib/conductorFs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_VISION = `
ULTRONOS к утру становится самонаблюдаемой, самотестируемой, саморасширяющейся станцией:
каждый pillar получает уникальную глубокую фичу, панель памяти обретает NL-search,
добавляется TimeMachine, RoomChat, cost & session аналитика, webhook-inbox, ThemeSwitcher,
property-based тесты, интеграции и аналитика. Каждый агент двигает свою колонну 22 раза за ночь.
`.trim();

const SEEDS: Record<AgentId, string[]> = {
  ultron: [
    "Command palette v2 с fuzzy search + keyboard macros",
    "Global macro recorder — сохраняет цепочки команд",
    "Keybinding editor с визуализацией конфликтов",
    "Session replayer — revive прошлую беседу по JSON-логу",
    "RoomChat multi-agent broadcast (ULTRON пишет, все слышат)",
    "Command palette presets + import/export JSON",
    "Inline keybinding tooltips в UI",
    "Session branch explorer (дерево ответвлений беседы)",
    "Global search по истории сессий",
    "Idle prompt suggester (LLM пре-предложения)",
    "Quick-switcher между pillars (Alt+1..6)",
    "Command audit log exporter",
  ],
  nova: [
    "NL-search API по памяти Galaxy + чатам",
    "Citation graph — откуда взят факт",
    "Auto-tag extractor для каждого сообщения",
    "RAG-lite over Obsidian vault",
    "Semantic similarity viewer между точками памяти",
    "Knowledge timeline по тегам",
    "Related-notes sidebar (похожие по cosine)",
    "Search-over-web с кэшированием",
    "Question answerer по собственной памяти",
    "Glossary extractor (частые термины + definition)",
    "Citation rank (PageRank over references)",
    "Memory diff viewer (как менялся контекст)",
  ],
  forge: [
    "ThemeSwitcher (dark/neon/paper/minimal)",
    "LayoutEditor drag-n-drop панелей",
    "CosmosBackground — анимированный звёздный фон",
    "Timezone+weather panel",
    "UI-preset library (сохраняемые layouts)",
    "Accent color picker + persistence",
    "Typography scale switcher",
    "Glass-morphism toggle",
    "Sound pack switcher (UI tick/ping)",
    "Motion intensity slider",
    "Grid density presets (compact/cozy/roomy)",
    "Panel minimize/dock controls",
  ],
  ares: [
    "Property-based tests для reducers (fast-check)",
    "Playwright e2e: main dashboard golden path",
    "Mutation testing для lib/bugCollector",
    "Error-boundary coverage: умышленный throw",
    "Snapshot tests для ConductorTimeline",
    "Fuzzing для JSON-парсеров",
    "Race condition tests (lock/heartbeat)",
    "Memory leak detector (repeat render)",
    "API contract tests (fetch mock)",
    "Accessibility audit (axe-core)",
    "Performance baseline (render budget)",
    "Regression suite для критичных path-ов",
  ],
  echo: [
    "GitHub status widget (public repo polling)",
    "Webhook inbox (receive + list)",
    "Telegram rich UI v2 (inline keyboards preview)",
    "Crypto ticker (free API)",
    "Uptime pinger для списка URL",
    "RSS feed aggregator",
    "HN top-stories panel",
    "Discord webhook sender",
    "Generic POST-bin tester",
    "Status-page composer",
    "Shortlink generator (local)",
    "Integration health matrix",
  ],
  midas: [
    "Cost dashboard — Claude usage по модели",
    "Session stats (tokens/turns/latency)",
    "Profile insights с recharts-like SVG",
    "Tool-use heatmap (agent × tool)",
    "Daily activity sparkline",
    "Cost forecast (linear extrapolation)",
    "Top-errors frequency chart",
    "Memory size over time",
    "Scout ideas leaderboard",
    "Pillar velocity tracker (files/slot)",
    "Gate health score per slot",
    "Anomaly alert (outlier slot)",
  ],
};

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "true";

  await ensureDirs();
  const existing = await readPlan();
  if (existing && !dry) {
    return Response.json(
      { status: "exists", plan: existing, message: "Plan already exists. Abort first to recreate." },
      { status: 409 },
    );
  }

  const now = new Date().toISOString();
  const slotCount = DEFAULTS.SLOT_COUNT;

  const skeleton: Plan["skeleton"] = {
    ultron: { title: PILLARS.ultron.name, seeds: SEEDS.ultron },
    nova: { title: PILLARS.nova.name, seeds: SEEDS.nova },
    forge: { title: PILLARS.forge.name, seeds: SEEDS.forge },
    ares: { title: PILLARS.ares.name, seeds: SEEDS.ares },
    echo: { title: PILLARS.echo.name, seeds: SEEDS.echo },
    midas: { title: PILLARS.midas.name, seeds: SEEDS.midas },
  };

  const plan: Plan = {
    createdAt: now,
    projectRoot: resolveProjectRoot(),
    vision: DEFAULT_VISION,
    visionLog: [{ ts: now, note: "initial vision", by: "conductor" }],
    skeleton,
    slotCount,
    currentSlot: 0,
    slots: [],
    degraded: false,
    redStreak: 0,
    revisionLog: [{ ts: now, slot: 0, by: "conductor", note: "plan created" }],
    scoutActive: false,
    aborted: false,
  };

  // materialize skeleton slots (brief will be built lazily per tick)
  for (let i = 0; i < slotCount; i += 1) {
    const slot: Slot = {
      index: i,
      startsAt: new Date(Date.now() + i * DEFAULTS.SLOT_MS).toISOString(),
      mode: i % 10 === 9 ? "polish" : "extend",
      briefs: { ultron: null, nova: null, forge: null, ares: null, echo: null, midas: null },
      status: "pending",
    };
    plan.slots.push(slot);
  }

  // seed slot 0 briefs up front
  plan.slots[0].briefs = buildAllBriefs(plan, 0, plan.slots[0].mode, [], AGENT_IDS);

  if (dry) {
    return Response.json({
      status: "dry",
      planPath: planPath(),
      slotCount,
      firstTitles: AGENT_IDS.map((id) => ({ id, title: plan.slots[0].briefs[id]?.title })),
      vision: plan.vision,
    });
  }

  await writePlan(plan);

  return Response.json({
    status: "created",
    planPath: planPath(),
    slotCount,
    vision: plan.vision,
  });
}

export async function GET() {
  const plan = await readPlan();
  if (!plan) return Response.json({ status: "none" }, { status: 404 });
  return Response.json({ status: "ok", plan });
}
