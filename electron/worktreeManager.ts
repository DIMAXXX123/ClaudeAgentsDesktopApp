import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Worktree {
  path: string;
  branch: string;
  agentId?: string;
  createdAt: string;
  hasChanges?: boolean;
}

/**
 * GitWorktreeManager — manages isolated git worktrees for agent processes.
 * Each agent spawns in its own worktree to prevent merge conflicts.
 */
class GitWorktreeManager {
  private worktreeRootDir: string;

  constructor(userDataDir: string) {
    this.worktreeRootDir = path.join(userDataDir, 'worktrees');
  }

  /**
   * Ensure worktree root directory exists.
   */
  async ensureDir(): Promise<void> {
    try {
      await fs.mkdir(this.worktreeRootDir, { recursive: true });
    } catch (err) {
      console.error(`[worktreeManager] Failed to ensure dir ${this.worktreeRootDir}:`, err);
      throw err;
    }
  }

  /**
   * Create a new git worktree for an agent.
   * Returns the worktree path and branch name.
   */
  async createWorktree(repoPath: string, agentId: string): Promise<{ worktreePath: string; branch: string }> {
    await this.ensureDir();

    // Validate repoPath is safe (has .git)
    const gitDir = path.join(repoPath, '.git');
    try {
      await fs.access(gitDir);
    } catch {
      throw new Error(`Invalid repo: ${repoPath} (no .git found)`);
    }

    const ts = Date.now();
    const branchName = `ultronos/${agentId}-${ts}`;
    const worktreePath = path.join(this.worktreeRootDir, `${agentId}-${ts}`);

    // Validate worktree path stays within rootDir
    const relative = path.relative(this.worktreeRootDir, worktreePath);
    if (relative.startsWith('..')) {
      throw new Error(`Invalid worktree path: ${worktreePath}`);
    }

    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['-C', repoPath, 'worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 30000,
      });

      let stdout = '';
      let stderr = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ worktreePath, branch: branchName });
        } else {
          reject(new Error(`git worktree add failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  /**
   * List all active worktrees with parsed metadata.
   */
  async listWorktrees(repoPath: string): Promise<Worktree[]> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['-C', repoPath, 'worktree', 'list', '--porcelain'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 10000,
      });

      let stdout = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          const lines = stdout.trim().split('\n').filter((l) => l);
          const worktrees: Worktree[] = [];

          for (const line of lines) {
            // Format: worktree <path>\nbranch <ref>\ndetached
            const match = line.match(/^worktree (.+)/);
            if (!match) continue;

            const wtPath = match[1];
            const nextIdx = lines.indexOf(line) + 1;
            const branchLine = nextIdx < lines.length ? lines[nextIdx] : '';
            const branchMatch = branchLine.match(/^branch (.+)/);
            const branch = branchMatch ? branchMatch[1].split('/').pop() || '' : 'detached';

            // Extract agentId from path
            const pathMatch = wtPath.match(/(\w+-\d+)$/);
            const agentId = pathMatch ? pathMatch[1].split('-')[0] : undefined;

            worktrees.push({
              path: wtPath,
              branch,
              agentId,
              createdAt: new Date().toISOString(), // TODO: get from stat
            });
          }

          resolve(worktrees);
        } else {
          reject(new Error(`git worktree list failed`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  /**
   * Remove a worktree and optionally force delete the branch.
   */
  async removeWorktree(worktreePath: string, force: boolean = false): Promise<void> {
    // Validate path stays within rootDir
    const relative = path.relative(this.worktreeRootDir, worktreePath);
    if (relative.startsWith('..')) {
      throw new Error(`Invalid worktree path: ${worktreePath}`);
    }

    // Check for uncommitted changes if not force
    if (!force) {
      const hasChanges = await this.hasUncommittedChanges(worktreePath);
      if (hasChanges) {
        throw new Error(`Worktree has uncommitted changes: ${worktreePath}. Use force=true to override.`);
      }
    }

    return new Promise((resolve, reject) => {
      const args = ['worktree', 'remove'];
      if (force) args.push('--force');
      args.push(worktreePath);

      const proc = spawn('git', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 10000,
      });

      let stderr = '';

      if (proc.stderr) {
        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`git worktree remove failed: ${stderr}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  /**
   * Prune stale worktree references.
   */
  async pruneStale(repoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['-C', repoPath, 'worktree', 'prune', '--verbose'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 10000,
      });

      let stdout = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          const count = (stdout.match(/Pruning/g) || []).length;
          resolve(count);
        } else {
          reject(new Error(`git worktree prune failed`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  /**
   * Get diff of worktree against a base ref.
   */
  async diffWorktree(worktreePath: string, baseRef: string = 'HEAD'): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['-C', worktreePath, 'diff', baseRef], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 10000,
      });

      let stdout = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      proc.on('close', (code) => {
        // Diff exit code 0 = no changes, 1 = changes found, others = error
        if (code === 0 || code === 1) {
          resolve(stdout);
        } else {
          reject(new Error(`git diff failed with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }

  /**
   * Check if worktree has uncommitted changes.
   */
  private async hasUncommittedChanges(worktreePath: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const proc = spawn('git', ['-C', worktreePath, 'status', '--porcelain'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: false,
        timeout: 5000,
      });

      let stdout = '';

      if (proc.stdout) {
        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });
      }

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim().length > 0);
        } else {
          reject(new Error(`git status failed`));
        }
      });

      proc.on('error', (err) => {
        reject(new Error(`Failed to spawn git: ${err.message}`));
      });
    });
  }
}

export const createWorktreeManager = (userDataDir: string): GitWorktreeManager => {
  return new GitWorktreeManager(userDataDir);
};
