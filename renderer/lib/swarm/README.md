# Swarm Mode

Параллельное выполнение задач через DAG decomposition. Opus 4.1 раскладывает цель на подзадачи, которые выполняются 6 агентами параллельно.

## Архитектура

```
User Goal
    ↓
/api/swarm/plan (decompose via Claude Opus)
    ↓
SwarmPlan (JSON: tasks + DAG deps)
    ↓
/api/swarm/run (executeSwarm)
    ↓
Parallel execution (max 4 tasks)
    ↓
Live polling → SwarmGantt visualization
```

## Файлы

- **types.ts** — `SwarmTask`, `SwarmPlan`, `TaskStatus`
- **decompose.ts** — `decomposeGoal(goal)` → вызывает Opus 4.1 с prompt для раскладки в DAG
- **executor.ts** — `executeSwarm(plan, callbacks)` → topological sort + параллельное выполнение (max 4)
- **index.ts** — экспорты

## API Routes

- `POST /api/swarm/plan` — {goal} → SwarmPlan (сохраняется в SWARM_DATA_DIR)
- `POST /api/swarm/run` — {planId} → starts async execution
- `GET /api/swarm/status/:id` — текущий план с progress
- `POST /api/swarm/abort` — {planId} → отменить план

## UI Компоненты

- **SwarmInput** — textarea для goal + кнопки Decompose/Execute
- **SwarmGantt** — горизонтальная timeline с bar'ами задач по агентам (TODO: dep lines)
- **SwarmTaskCard** — clickable карточка с prompt/output/error/deps

## Использование

```tsx
import { SwarmInput, SwarmGantt } from "@/components/swarm";
import { useSwarmPlan } from "@/lib/useSwarmPlan";

export default function Page() {
  const [planId, setPlanId] = useState<string | null>(null);
  const { plan } = useSwarmPlan(planId);

  return (
    <>
      <SwarmInput onPlanCreated={(p) => setPlanId(p.id)} />
      <SwarmGantt plan={plan} />
    </>
  );
}
```

## Параллелизм

Executor использует простой algorithm:
1. Topological sort по deps
2. While not done:
   - Find tasks готовые к запуску (все deps done, status pending)
   - Start up to MAX_PARALLEL=4
   - Wait 500ms

Зависимости образуют DAG (no cycles), тыс гарантирует корректный порядок.

## TODO

- Dep lines в Gantt (стрелки между bar'ами)
- Streaming output вместо polling
- Graceful shutdown при abort
- Agent sessionId tracking
