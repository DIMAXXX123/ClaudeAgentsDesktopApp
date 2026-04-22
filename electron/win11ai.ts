import { spawn } from 'child_process';
import * as path from 'path';
import { ipcMain, BrowserWindow } from 'electron';

type OcrResult = { text: string; lines?: Array<{ text: string; bbox?: unknown }> };
type SummarizeResult = { summary: string };
type DescribeResult = { description: string };
type GenerateResult = { text: string };
type ErrorResult = { error: string; detail?: string };

const PYTHON_PATH = process.env.ULTRONOS_PYTHON || 'python3';
const SCRIPT_PATH = path.join(__dirname, '../scripts/win11ai.py');
const TIMEOUT_MS = 30000;

/**
 * Run Python win11ai.py script with timeout and JSON parsing.
 */
function runPythonScript(
  command: string,
  args: string[] = [],
  stdin?: string
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON_PATH, [SCRIPT_PATH, command, ...args], {
      timeout: TIMEOUT_MS,
      shell: false,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        USERPROFILE: process.env.USERPROFILE,
        APPDATA: process.env.APPDATA,
        LOCALAPPDATA: process.env.LOCALAPPDATA,
        SystemRoot: process.env.SystemRoot,
        PYTHONIOENCODING: 'utf-8',
      },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    if (stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }

    proc.on('close', (code) => {
      try {
        const result = JSON.parse(stdout);
        if (code === 0) {
          resolve(result);
        } else if (code === 2) {
          // Platform unsupported
          resolve(result);
        } else if (code === 1) {
          // Command error
          resolve(result);
        } else {
          resolve({ error: 'unknown_exit_code', detail: `Exit code ${code}: ${stderr}` });
        }
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}\nStderr: ${stderr}`));
      }
    });

    proc.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Check if Windows 11 AI runtime is available.
 */
export async function isAvailable(): Promise<boolean> {
  try {
    const result = await runPythonScript('ocr', []);
    // If result has an error about platform, it's not available
    if (result.error === 'not_available' || result.error === 'unsupported') {
      return false;
    }
    // If it's winrt_not_available or implementation not done, still return true
    // because the platform supports it (just needs packages installed)
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract text from image using OCR.
 */
export async function ocrImage(imagePath: string): Promise<OcrResult | ErrorResult> {
  try {
    const result = await runPythonScript('ocr', [imagePath]);
    return result as OcrResult | ErrorResult;
  } catch (err) {
    return {
      error: 'ocr_exception',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Summarize text using Phi Silica.
 */
export async function summarize(text: string): Promise<SummarizeResult | ErrorResult> {
  try {
    const result = await runPythonScript('summarize', [], text);
    return result as SummarizeResult | ErrorResult;
  } catch (err) {
    return {
      error: 'summarize_exception',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Describe image content.
 */
export async function describeImage(imagePath: string): Promise<DescribeResult | ErrorResult> {
  try {
    const result = await runPythonScript('describe', [imagePath]);
    return result as DescribeResult | ErrorResult;
  } catch (err) {
    return {
      error: 'describe_exception',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Generate text using Phi Silica.
 */
export async function generate(prompt: string): Promise<GenerateResult | ErrorResult> {
  try {
    const result = await runPythonScript('generate', [prompt]);
    return result as GenerateResult | ErrorResult;
  } catch (err) {
    return {
      error: 'generate_exception',
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Register Windows 11 AI IPC handlers.
 */
export function registerWin11AiIpc(): void {
  ipcMain.handle('ultronos:win11ai:available', async () => {
    return await isAvailable();
  });

  ipcMain.handle('ultronos:win11ai:ocr', async (_, imagePath: string) => {
    return await ocrImage(imagePath);
  });

  ipcMain.handle('ultronos:win11ai:summarize', async (_, text: string) => {
    return await summarize(text);
  });

  ipcMain.handle('ultronos:win11ai:describe', async (_, imagePath: string) => {
    return await describeImage(imagePath);
  });

  ipcMain.handle('ultronos:win11ai:generate', async (_, prompt: string) => {
    return await generate(prompt);
  });
}
