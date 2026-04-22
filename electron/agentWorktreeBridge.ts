import * as path from 'path';
import { agentRegistry, AgentRuntime } from './agentRegistry';
import { createWorktreeManager } from './worktreeManager';

export interface IsolationOpts {
  isolated?: boolean;
  repoPath?: string;
}

/**
 * AgentWorktreeBridge — bridges agent spawning with automatic worktree isolation.
 * When spawning with { isolated: true }, creates a worktree and sets it as cwd.
 */
class AgentWorktreeBridge {
  private worktreeManager: ReturnType<typeof createWorktreeManager>;
  private worktreeMap: Map<string, { path: string; repoPath: string }> = new Map();

  constructor(private userDataDir: string) {
    this.worktreeManager = createWorktreeManager(userDataDir);
  }

  /**
   * Spawn an agent with optional worktree isolation.
   */
  async spawnWithIsolation(agentId: string, opts?: { isolated?: boolean; repoPath?: string; systemPrompt?: string }): Promise<AgentRuntime> {
    if (!opts?.isolated) {
      // No isolation — spawn normally
      return agentRegistry.spawnAgent(agentId, { systemPrompt: opts?.systemPrompt });
    }

    // Create worktree
    const repoPath = opts.repoPath || process.cwd();
    let worktreePath: string;

    try {
      const result = await this.worktreeManager.createWorktree(repoPath, agentId);
      worktreePath = result.worktreePath;
      this.worktreeMap.set(agentId, { path: worktreePath, repoPath });
    } catch (err) {
      console.error(`[agentWorktreeBridge] Failed to create worktree for ${agentId}:`, err);
      throw err;
    }

    // Spawn with worktree cwd
    const runtime = agentRegistry.spawnAgent(agentId, { systemPrompt: opts?.systemPrompt });

    // TODO: Update runtime.process to use worktreePath as cwd
    // This requires modifying agentRegistry.spawnAgent to accept cwd option
    // For now, worktree is created but process cwd is not set

    return runtime;
  }

  /**
   * Kill an agent and clean up its worktree if isolated.
   */
  async killWithCleanup(sessionId: string, force: boolean = true): Promise<void> {
    const runtime = agentRegistry.getRuntime(sessionId);
    if (!runtime) {
      console.warn(`[agentWorktreeBridge] No runtime found for ${sessionId}`);
      return;
    }

    // Kill the agent
    await agentRegistry.killAgent(sessionId);

    // Clean up worktree if exists
    const wtEntry = this.worktreeMap.get(runtime.agentId);
    if (wtEntry) {
      try {
        await this.worktreeManager.removeWorktree(wtEntry.path, force);
        this.worktreeMap.delete(runtime.agentId);
      } catch (err) {
        console.error(`[agentWorktreeBridge] Failed to remove worktree for ${runtime.agentId}:`, err);
      }
    }
  }

  /**
   * Get worktree path for an agent.
   */
  getWorktreePath(agentId: string): string | undefined {
    return this.worktreeMap.get(agentId)?.path;
  }
}

// Singleton instance
let bridgeInstance: AgentWorktreeBridge | null = null;

export const initWorktreeBridge = (userDataDir: string): AgentWorktreeBridge => {
  if (!bridgeInstance) {
    bridgeInstance = new AgentWorktreeBridge(userDataDir);
  }
  return bridgeInstance;
};

export const getWorktreeBridge = (): AgentWorktreeBridge | null => {
  return bridgeInstance;
};
