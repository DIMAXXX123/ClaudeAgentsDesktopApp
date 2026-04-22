import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

/**
 * HTTP endpoint for voice transcription (fallback for non-Electron environments).
 * Accepts multipart/form-data with audio file.
 * Uses Python whisper script to transcribe.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;

    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Save to temp file
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `voice-${Date.now()}.webm`);
    const buffer = await audioFile.arrayBuffer();

    fs.writeFileSync(tempPath, Buffer.from(buffer));

    // Run transcription
    const transcript = await transcribeAudio(tempPath);

    // Cleanup
    try {
      fs.unlinkSync(tempPath);
    } catch (e) {
      console.warn('[voice/transcribe] failed to cleanup:', e);
    }

    return NextResponse.json({
      transcript,
      success: true,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[voice/transcribe] error:', msg);
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}

/**
 * Transcribe audio using Python whisper script.
 */
function transcribeAudio(audioPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const pythonExe = process.env.ULTRONOS_PYTHON || 'python3';
    const whisperScript = path.join(
      process.env.USERPROFILE || '',
      '.claude',
      'scripts',
      'transcribe_voice.py'
    );

    if (!fs.existsSync(whisperScript)) {
      reject(
        new Error(
          `Whisper script not found at ${whisperScript}`
        )
      );
      return;
    }

    const proc = spawn(pythonExe, [whisperScript, audioPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60000,
    });

    let stdout = '';
    let stderr = '';

    const timeoutHandle = setTimeout(() => {
      if (!proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 60000);

    if (proc.stdout) {
      proc.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8');
      });
    }

    if (proc.stderr) {
      proc.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8');
      });
    }

    proc.on('close', (code) => {
      clearTimeout(timeoutHandle);

      if (code !== 0) {
        reject(
          new Error(
            `Whisper exited with code ${code}: ${stderr}`
          )
        );
        return;
      }

      const transcript = stdout.trim();
      resolve(transcript);
    });

    proc.on('error', (err) => {
      clearTimeout(timeoutHandle);
      reject(err);
    });
  });
}
