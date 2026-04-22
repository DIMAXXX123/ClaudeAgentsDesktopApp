import { spawn, ChildProcess } from 'child_process';
import { app } from 'electron';
import * as path from 'path';
import * as net from 'net';

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => (port ? resolve(port) : reject(new Error('port alloc failed'))));
    });
  });
}

let nextServerProcess: ChildProcess | null = null;

export async function startNextServer(): Promise<string> {
  const devUrl = process.env.ULTRONOS_DEV_URL;

  // Dev mode: return the pre-configured URL
  if (devUrl) {
    console.log(`[next] Using dev server: ${devUrl}`);
    return devUrl;
  }

  // Prod mode: spawn standalone server
  const standaloneServerPath = getStandaloneServerPath();
  const port = await findFreePort();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      nextServerProcess?.kill('SIGKILL');
      reject(new Error('Next.js server failed to start within 15s timeout'));
    }, 15000);

    try {
      nextServerProcess = spawn(process.execPath, [standaloneServerPath], {
        cwd: path.dirname(standaloneServerPath),
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          PORT: String(port),
          HOSTNAME: '127.0.0.1',
          ULTRONOS_DATA_DIR: app.getPath('userData'),
        },
        stdio: 'pipe',
      });

      if (!nextServerProcess.stdout || !nextServerProcess.stderr) {
        clearTimeout(timeout);
        reject(new Error('Failed to create stdout/stderr pipes'));
        return;
      }

      let resolved = false;

      const onData = (data: Buffer) => {
        const line = data.toString();
        console.log(`[next] ${line}`);

        if (resolved) return;

        // Try to match "http://127.0.0.1:PORT" or "on 0.0.0.0:PORT"
        const httpMatch = line.match(/http:\/\/([\d.]+):(\d+)/);
        if (httpMatch) {
          resolved = true;
          clearTimeout(timeout);
          const port = httpMatch[2];
          const url = `http://127.0.0.1:${port}`;
          resolve(url);
          return;
        }

        const portMatch = line.match(/on 0\.0\.0\.0:(\d+)/);
        if (portMatch) {
          resolved = true;
          clearTimeout(timeout);
          const port = portMatch[1];
          const url = `http://127.0.0.1:${port}`;
          resolve(url);
          return;
        }
      };

      nextServerProcess.stdout.on('data', onData);
      nextServerProcess.stderr.on('data', onData);

      nextServerProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(error);
        }
      });

      nextServerProcess.on('exit', (code) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          reject(new Error(`Next.js server exited with code ${code}`));
        }
      });
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });
}

export function stopNextServer(): void {
  if (!nextServerProcess) return;

  if (!nextServerProcess.killed) {
    nextServerProcess.kill('SIGTERM');

    // Force kill after 3s if not dead
    const forceKillTimeout = setTimeout(() => {
      if (!nextServerProcess?.killed) {
        nextServerProcess?.kill('SIGKILL');
      }
    }, 3000);

    nextServerProcess.on('exit', () => {
      clearTimeout(forceKillTimeout);
    });
  }

  nextServerProcess = null;
}

function getStandaloneServerPath(): string {
  // Next standalone output nests server.js inside a subfolder named after the package root.
  // Package name is "ultronos-clone" (from renderer/package.json) -> .next/standalone/renderer/server.js
  // Actually Next uses the folder name of the app, which in our case is "renderer".

  if (process.resourcesPath && process.resourcesPath.includes('app.asar')) {
    return path.join(process.resourcesPath, 'app', 'renderer', '.next', 'standalone', 'renderer', 'server.js');
  }

  return path.join(__dirname, '..', 'renderer', '.next', 'standalone', 'renderer', 'server.js');
}
