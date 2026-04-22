# Git Worktree Integration TODO

## Completed
- [x] `electron/worktreeManager.ts` — core worktree operations (create, list, remove, prune, diff)
- [x] `electron/agentWorktreeBridge.ts` — bridge for agent spawning with worktree isolation
- [x] `electron/worktreeIpc.ts` — IPC handlers
- [x] `electron/main.ts` — register IPC handlers
- [x] `electron/preload.ts` — expose worktree API to renderer
- [x] `renderer/types/ultronos.d.ts` — type definitions
- [x] `renderer/lib/useWorktrees.ts` — React hook
- [x] `renderer/components/worktree/WorktreePanel.tsx` — UI component
- [x] `renderer/components/worktree/WorktreeDiffModal.tsx` — diff viewer
- [x] `renderer/app/worktrees/page.tsx` — management page
- [x] `renderer/app/api/worktree/{list,create,remove,diff}/route.ts` — HTTP fallback routes
- [x] TypeScript green (renderer + electron)

## Future: Integration with agentRegistry

To enable automatic worktree isolation for agents:

1. Modify `agentRegistry.spawnAgent()` to accept `opts.isolated: boolean`
2. When `isolated: true`:
   - Call `agentWorktreeBridge.spawnWithIsolation(agentId, opts)`
   - Bridge creates worktree and returns path
   - Pass worktree path as `cwd` to `spawn()` call
3. On agent kill: cleanup worktree (call bridge)

Current worktreeManager design:
- All paths validated (stay within userData/worktrees/)
- git spawn with timeout 30s
- No uncommitted changes check before remove (unless force=true)
- Diff returns raw git output (no syntax highlight — done in UI)

## Files Created
- electron/worktreeManager.ts (233 lines)
- electron/agentWorktreeBridge.ts (88 lines)
- electron/worktreeIpc.ts (64 lines)
- renderer/lib/useWorktrees.ts (126 lines)
- renderer/components/worktree/WorktreePanel.tsx (124 lines)
- renderer/components/worktree/WorktreeDiffModal.tsx (95 lines)
- renderer/app/worktrees/page.tsx (149 lines)
- renderer/app/api/worktree/list/route.ts (24 lines)
- renderer/app/api/worktree/create/route.ts (27 lines)
- renderer/app/api/worktree/remove/route.ts (29 lines)
- renderer/app/api/worktree/diff/route.ts (28 lines)

## Modified Files
- electron/main.ts (1 import, 1 call)
- electron/preload.ts (15 lines added for worktree API)
- renderer/types/ultronos.d.ts (6 lines added for worktree types)

## Protected Files (NOT Modified)
- electron/agentRegistry.ts
- electron/persistence.ts
- electron/liveFeed.ts
- electron/launcher.ts
- electron/win11ai.ts
- electron/modeSwitcher.ts
- electron/voiceInput.ts
