import { ipcMain, app } from 'electron';
import { createWorktreeManager, Worktree } from './worktreeManager';

const worktreeManager = createWorktreeManager(app.getPath('userData'));

/**
 * Register IPC handlers for worktree operations.
 */
export function registerWorktreeIpc(): void {
  // Create a new worktree for an agent
  ipcMain.handle('ultronos:worktree:create', async (_, args: { repoPath: string; agentId: string }) => {
    try {
      const result = await worktreeManager.createWorktree(args.repoPath, args.agentId);
      return { success: true, data: result };
    } catch (error) {
      console.error('[worktreeIpc:create]', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // List all worktrees
  ipcMain.handle('ultronos:worktree:list', async (_, args: { repoPath: string }) => {
    try {
      const worktrees = await worktreeManager.listWorktrees(args.repoPath);
      return { success: true, data: worktrees };
    } catch (error) {
      console.error('[worktreeIpc:list]', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Remove a worktree
  ipcMain.handle('ultronos:worktree:remove', async (_, args: { worktreePath: string; force?: boolean }) => {
    try {
      await worktreeManager.removeWorktree(args.worktreePath, args.force ?? false);
      return { success: true };
    } catch (error) {
      console.error('[worktreeIpc:remove]', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Prune stale worktrees
  ipcMain.handle('ultronos:worktree:prune', async (_, args: { repoPath: string }) => {
    try {
      const count = await worktreeManager.pruneStale(args.repoPath);
      return { success: true, data: { pruned: count } };
    } catch (error) {
      console.error('[worktreeIpc:prune]', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Get diff of a worktree
  ipcMain.handle('ultronos:worktree:diff', async (_, args: { worktreePath: string; baseRef?: string }) => {
    try {
      const diff = await worktreeManager.diffWorktree(args.worktreePath, args.baseRef ?? 'HEAD');
      return { success: true, data: { diff } };
    } catch (error) {
      console.error('[worktreeIpc:diff]', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
