import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';

export interface TranscriptEvent {
  ts: number;
  kind: 'stdout' | 'stderr' | 'input' | 'event' | 'status';
  data: string;
  role?: 'user' | 'assistant' | 'system';
}

class PersistenceManager {
  /**
   * Append a single transcript event as NDJSON (one JSON object per line).
   */
  async appendTranscript(agentId: string, sessionId: string, ev: TranscriptEvent): Promise<void> {
    const dir = this.getTranscriptDir(agentId);
    await fsPromises.mkdir(dir, { recursive: true });

    const filePath = path.join(dir, `${sessionId}.ndjson`);
    const line = JSON.stringify(ev) + '\n';

    // Sequential append to avoid concurrent writes on same file
    return new Promise((resolve, reject) => {
      fs.appendFile(filePath, line, 'utf-8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  /**
   * Read transcript events from a sessionId file.
   * limit: max number of lines to return
   * offset: skip first N lines (for pagination)
   */
  async readTranscript(sessionId: string, limit: number = 200, offset: number = 0): Promise<TranscriptEvent[]> {
    // sessionId files can be scattered across multiple agents
    // For now, search in all agent dirs
    const userData = app.getPath('userData');
    const agentsDir = path.join(userData, 'agents');

    const events: TranscriptEvent[] = [];

    try {
      const agentDirs = await fsPromises.readdir(agentsDir, { withFileTypes: true });
      for (const dirent of agentDirs) {
        if (!dirent.isDirectory()) continue;

        const filePath = path.join(agentsDir, dirent.name, `${sessionId}.ndjson`);
        try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter((line) => line.trim());

          for (const line of lines.slice(offset, offset + limit)) {
            try {
              events.push(JSON.parse(line) as TranscriptEvent);
            } catch (e) {
              console.warn(`[persistence] failed to parse line in ${sessionId}:`, e);
            }
          }

          if (events.length >= limit) break;
        } catch (e) {
          // File doesn't exist for this agent, continue
        }
      }
    } catch (e) {
      console.error(`[persistence] readTranscript failed:`, e);
    }

    return events;
  }

  /**
   * Delete transcript file for a sessionId.
   */
  async clearTranscript(sessionId: string): Promise<void> {
    const userData = app.getPath('userData');
    const agentsDir = path.join(userData, 'agents');

    try {
      const agentDirs = await fsPromises.readdir(agentsDir, { withFileTypes: true });
      for (const dirent of agentDirs) {
        if (!dirent.isDirectory()) continue;

        const filePath = path.join(agentsDir, dirent.name, `${sessionId}.ndjson`);
        try {
          await fsPromises.unlink(filePath);
        } catch (e) {
          // File doesn't exist, ignore
        }
      }
    } catch (e) {
      console.error(`[persistence] clearTranscript failed:`, e);
    }
  }

  /**
   * Rotate transcript if it exceeds 10k lines.
   * Creates .1, .2, etc. archived files.
   */
  async rotateIfNeeded(agentId: string, sessionId?: string): Promise<void> {
    const dir = this.getTranscriptDir(agentId);

    try {
      const files = sessionId
        ? [`${sessionId}.ndjson`]
        : await fsPromises.readdir(dir);

      for (const file of files) {
        if (!file.endsWith('.ndjson')) continue;

        const filePath = path.join(dir, file);
        try {
          const content = await fsPromises.readFile(filePath, 'utf-8');
          const lines = content.split('\n').filter((line) => line.trim());

          if (lines.length > 10000) {
            // Move current file to .1, .2, etc.
            const baseName = file.replace('.ndjson', '');
            let archiveIdx = 1;
            let archivePath = path.join(dir, `${baseName}.${archiveIdx}.ndjson`);

            while (fs.existsSync(archivePath)) {
              archiveIdx++;
              archivePath = path.join(dir, `${baseName}.${archiveIdx}.ndjson`);
            }

            // Keep only recent 10k lines in main file
            const recentLines = lines.slice(-10000).join('\n') + '\n';
            await fsPromises.writeFile(filePath, recentLines, 'utf-8');

            // Archive old lines
            const oldLines = lines.slice(0, -10000).join('\n') + '\n';
            await fsPromises.writeFile(archivePath, oldLines, 'utf-8');

            console.log(`[persistence] rotated ${file} → ${path.basename(archivePath)}`);
          }
        } catch (e) {
          console.error(`[persistence] rotate failed for ${file}:`, e);
        }
      }
    } catch (e) {
      console.error(`[persistence] rotateIfNeeded failed:`, e);
    }
  }

  /**
   * Get transcript directory for an agent.
   */
  private getTranscriptDir(agentId: string): string {
    const userData = app.getPath('userData');
    return path.join(userData, 'agents', agentId);
  }
}

export const persistence = new PersistenceManager();

// Export convenience functions for external use
export const appendTranscript = (agentId: string, sessionId: string, ev: TranscriptEvent) =>
  persistence.appendTranscript(agentId, sessionId, ev);
export const readTranscript = (sessionId: string, limit?: number, offset?: number) =>
  persistence.readTranscript(sessionId, limit, offset);
export const clearTranscript = (sessionId: string) =>
  persistence.clearTranscript(sessionId);
export const rotateIfNeeded = (agentId: string, sessionId?: string) =>
  persistence.rotateIfNeeded(agentId, sessionId);
