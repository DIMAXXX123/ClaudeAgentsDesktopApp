import { ipcMain, BrowserWindow, app } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { agentRegistry } from './agentRegistry';

export interface VoiceRecording {
  recordingId: string;
  transcript: string;
  duration: number;
}

interface PendingTranscription {
  recordingId: string;
  process: ChildProcess;
  timeout: NodeJS.Timeout;
}

class VoiceInputManager {
  private transcodingProcesses: Map<string, PendingTranscription> = new Map();
  private voiceDataDir: string = '';

  constructor() {
    this.voiceDataDir = path.join(app.getPath('userData'), 'voice');
    this.ensureVoiceDir();
  }

  private ensureVoiceDir(): void {
    if (!fs.existsSync(this.voiceDataDir)) {
      fs.mkdirSync(this.voiceDataDir, { recursive: true });
    }
  }

  /**
   * Stop recording signal from renderer.
   * Receives webm/ogg blob as Uint8Array, saves to disk, transcribes via Python whisper.
   * Broadcasts ultronos:voice:complete when done.
   */
  async handleStopRecording(
    recordingId: string,
    audioData: Uint8Array,
    mainWindow: BrowserWindow
  ): Promise<VoiceRecording> {
    const audioPath = path.join(this.voiceDataDir, `${recordingId}.webm`);

    // Save audio file
    fs.writeFileSync(audioPath, audioData);
    console.log(`[voice] saved audio to ${audioPath}`);

    // Transcribe
    const result = await this.transcribeAudio(recordingId, audioPath, mainWindow);

    // Cleanup audio file after transcription
    try {
      fs.unlinkSync(audioPath);
    } catch (e) {
      console.warn(`[voice] failed to cleanup ${audioPath}:`, e);
    }

    return result;
  }

  /**
   * Transcribe audio file using Python whisper script.
   * Broadcasts ultronos:voice:partial and ultronos:voice:complete events.
   */
  private async transcribeAudio(
    recordingId: string,
    audioPath: string,
    mainWindow: BrowserWindow
  ): Promise<VoiceRecording> {
    return new Promise((resolve, reject) => {
      const pythonExe = process.env.ULTRONOS_PYTHON || 'python3';
      const whisperScript = path.join(app.getPath('userData'), '..', 'scripts', 'transcribe_voice.py');

      // Fallback to global location
      const fallbackWhisperScript = path.join(
        process.env.USERPROFILE || '',
        '.claude',
        'scripts',
        'transcribe_voice.py'
      );

      const scriptPath = fs.existsSync(whisperScript) ? whisperScript : fallbackWhisperScript;

      if (!fs.existsSync(scriptPath)) {
        const err = new Error(
          `Whisper script not found at ${whisperScript} or ${fallbackWhisperScript}`
        );
        console.error('[voice]', err.message);
        mainWindow.webContents.send('ultronos:voice:error', {
          recordingId,
          error: err.message,
        });
        reject(err);
        return;
      }

      const startTime = Date.now();
      const proc = spawn(pythonExe, [scriptPath, audioPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 60000, // 60s timeout
      });

      let stdout = '';
      let stderr = '';

      // Setup timeout kill
      const timeoutHandle = setTimeout(() => {
        if (!proc.killed) {
          console.warn(`[voice] transcription timeout for ${recordingId}, killing process`);
          proc.kill('SIGKILL');
        }
      }, 60000);

      if (proc.stdout) {
        proc.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString('utf-8');
          stdout += text;

          // Broadcast partial transcript every chunk
          mainWindow.webContents.send('ultronos:voice:partial', {
            recordingId,
            partial: text,
          });
        });
      }

      if (proc.stderr) {
        proc.stderr.on('data', (chunk: Buffer) => {
          stderr += chunk.toString('utf-8');
        });
      }

      proc.on('close', (code) => {
        clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;

        if (code !== 0) {
          const err = new Error(
            `Whisper exited with code ${code}: ${stderr}`
          );
          console.error('[voice]', err.message);
          mainWindow.webContents.send('ultronos:voice:error', {
            recordingId,
            error: err.message,
          });
          this.transcodingProcesses.delete(recordingId);
          reject(err);
          return;
        }

        const transcript = stdout.trim();
        console.log(`[voice] transcribed (${duration}ms): "${transcript}"`);

        // Broadcast complete
        mainWindow.webContents.send('ultronos:voice:complete', {
          recordingId,
          transcript,
          duration,
        });

        this.transcodingProcesses.delete(recordingId);
        resolve({ recordingId, transcript, duration });
      });

      proc.on('error', (err) => {
        clearTimeout(timeoutHandle);
        console.error('[voice] process error:', err);
        mainWindow.webContents.send('ultronos:voice:error', {
          recordingId,
          error: err.message,
        });
        this.transcodingProcesses.delete(recordingId);
        reject(err);
      });

      // Store process for potential cleanup
      this.transcodingProcesses.set(recordingId, {
        recordingId,
        process: proc,
        timeout: timeoutHandle,
      });
    });
  }

  /**
   * Send transcript to active agent session via input channel.
   */
  async sendToAgent(sessionId: string, transcript: string): Promise<void> {
    try {
      const result = await agentRegistry.sendInput(sessionId, transcript);
      console.log(`[voice] sent to agent session ${sessionId}:`, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[voice] failed to send to agent:`, msg);
      throw e;
    }
  }

  /**
   * Cleanup on shutdown.
   */
  cleanup(): void {
    this.transcodingProcesses.forEach(({ process, timeout }) => {
      clearTimeout(timeout);
      if (!process.killed) {
        process.kill('SIGKILL');
      }
    });
    this.transcodingProcesses.clear();
  }
}

const voiceManager = new VoiceInputManager();

export function registerVoiceIpc(mainWindow: BrowserWindow): void {
  /**
   * ultronos:voice:start — signal to begin recording (handled in renderer via MediaRecorder)
   * Returns { recordingId } to track this session
   */
  ipcMain.handle('ultronos:voice:start', async (_event, data: { recordingId: string }) => {
    console.log(`[voice] recording started: ${data.recordingId}`);
    return { recordingId: data.recordingId };
  });

  /**
   * ultronos:voice:stop — receive audio blob, transcribe, broadcast completion
   * Expects: { recordingId: string, audioData: Uint8Array }
   * Returns: { transcript: string, duration: number, recordingId: string }
   */
  ipcMain.handle(
    'ultronos:voice:stop',
    async (
      _event,
      data: {
        recordingId: string;
        audioData: Uint8Array;
      }
    ): Promise<VoiceRecording> => {
      try {
        const result = await voiceManager.handleStopRecording(
          data.recordingId,
          data.audioData,
          mainWindow
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Voice transcription failed: ${msg}`);
      }
    }
  );

  /**
   * ultronos:voice:send-to-agent — route transcript to active agent session
   * Expects: { sessionId: string, transcript: string }
   */
  ipcMain.handle(
    'ultronos:voice:send-to-agent',
    async (_event, data: { sessionId: string; transcript: string }) => {
      try {
        await voiceManager.sendToAgent(data.sessionId, data.transcript);
        return { sent: true };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to send to agent: ${msg}`);
      }
    }
  );

  /**
   * ultronos:voice:transcribe — just transcribe without routing
   * Expects: { recordingId: string, audioData: Uint8Array }
   * Returns: { transcript: string, duration: number }
   */
  ipcMain.handle(
    'ultronos:voice:transcribe',
    async (
      _event,
      data: {
        recordingId: string;
        audioData: Uint8Array;
      }
    ): Promise<VoiceRecording> => {
      try {
        const result = await voiceManager.handleStopRecording(
          data.recordingId,
          data.audioData,
          mainWindow
        );
        return result;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Voice transcription failed: ${msg}`);
      }
    }
  );

  console.log('[voice] IPC handlers registered');
}

export function cleanupVoiceOnQuit(): void {
  voiceManager.cleanup();
}
