import type { AgentBrief, AgentId, Plan, ScoutIdea, SlotMode } from "./conductor";
import { PILLARS, PROTECTED_PATHS, SHARED_LOCK_FILES } from "./conductor";

const SAFETY_BLOCK = `
=== НЕЛЬЗЯ ===
- Команды: next dev / next start / npm run dev / bun run dev / taskkill / Stop-Process / pkill / rm -rf.
- Трогать порт :3000 — dev-server живой, не перезапускай.
- Трогать TG-бот в C:\\Users\\Dimax\\Documents\\claude-workspace\\telegram-bot (живой python).
- Ставить npm/bun пакеты — запиши идею в .overnight-plan/dep-requests.md, остановись.
- Редактировать protected paths: ${PROTECTED_PATHS.join(", ")}. Если задача требует — верни строку "BLOCKED: <path>" и выходи.
- Shared файлы ${SHARED_LOCK_FILES.join(", ")}: только ULTRON может писать. Остальные — TODO в .overnight-plan/journal.md.
- ESLint не существует в проекте — не пытайся запустить.
`.trim();

const RETRO_REQUEST = `
=== ВАЖНО: RETRO ===
В КОНЦЕ работы запиши файл .overnight-plan/slot-<SLOT>/retro-<AGENT_ID>.json со структурой:
{
  "agentId": "<твой id>",
  "filesTouched": ["относительный/путь/1", ...],
  "summary": "3-5 строк что сделал",
  "blockers": ["если что-то заблочило — строка, иначе []"],
  "confidence": 0.0-1.0,
  "toolCalls": <число>,
  "durationMs": <оценка>
}
Без retro.json — слот не засчитан.
`.trim();

export function buildBrief(
  plan: Plan,
  slot: number,
  agentId: AgentId,
  mode: SlotMode,
  scoutIdeas: ScoutIdea[],
): AgentBrief {
  const pillar = PILLARS[agentId];
  const skeleton = plan.skeleton[agentId];
  const pick = skeleton.seeds[slot % skeleton.seeds.length];
  const relevantScout = scoutIdeas
    .filter((i) => i.pillar === agentId || i.pillar === "any")
    .slice(0, 3);

  const modeNote =
    mode === "polish"
      ? "Режим POLISH: улучшай существующее в твоей зоне (тесты, edge cases, UX)."
      : mode === "stabilization"
        ? "Режим STABILIZATION: только фиксить tsc/vitest ошибки. Никаких новых фич."
        : "Режим EXTEND: создай новую фичу в своей зоне.";

  const scoutBlock = relevantScout.length
    ? `\n=== SCOUT FEED (свежие идеи, опционально) ===\n${relevantScout
        .map((i) => `- [${i.rank}] ${i.idea}${i.sourceUrl ? " — " + i.sourceUrl : ""}`)
        .join("\n")}`
    : "";

  const instructions = `
Ты — ${agentId.toUpperCase()}, pillar "${pillar.name}". Слот ${slot} из ${plan.slotCount}.
${modeNote}

Vision: ${plan.vision}

Твоя зона (ЭКСКЛЮЗИВНО твоя — пиши ТОЛЬКО сюда):
${pillar.ownedPaths.map((p) => "  " + p).join("\n")}

Задача: ${pick}
${scoutBlock}

Требования:
1. Создавай реальные фичи (не stub-и). Новые файлы внутри owned-paths.
2. Пиши файлы в t.ч. тест(ы) (если pillar != ARES то inline-тест для своей фичи, если ARES — в tests/).
3. Не трогай файлы вне своей зоны. Shared — запрещены (кроме ULTRON).
4. Не вызывай npm install / dev-server / taskkill.
5. Перед Write/Edit/Bash — прочти .overnight-plan/protected.txt чтобы свериться.
6. maxTurns ограничен — будь быстр и эффективен.

${SAFETY_BLOCK}

${RETRO_REQUEST.replace("<SLOT>", String(slot)).replace("<AGENT_ID>", agentId)}

Итог: коротко что сделал (2-3 строки) + список созданных/правленных файлов.
`.trim();

  return {
    agentId,
    title: pick,
    mode,
    instructions,
    scoutIdeas: relevantScout,
  };
}

export function buildAllBriefs(
  plan: Plan,
  slot: number,
  mode: SlotMode,
  scoutIdeas: ScoutIdea[],
  activeAgents: AgentId[],
): Record<AgentId, AgentBrief | null> {
  const out: Record<AgentId, AgentBrief | null> = {
    ultron: null,
    nova: null,
    forge: null,
    ares: null,
    echo: null,
    midas: null,
  };
  for (const id of activeAgents) {
    out[id] = buildBrief(plan, slot, id, mode, scoutIdeas);
  }
  return out;
}

/**
 * Check no duplicate titles across agents in the same slot.
 */
export function hasNoDuplicates(briefs: Record<AgentId, AgentBrief | null>): boolean {
  const titles = Object.values(briefs)
    .filter((b): b is AgentBrief => b !== null)
    .map((b) => b.title.trim().toLowerCase());
  return new Set(titles).size === titles.length;
}
