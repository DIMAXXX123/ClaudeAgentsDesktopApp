'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface VoiceHookState {
  isRecording: boolean;
  level: number; // 0-100
  transcript: string;
  isTranscribing: boolean;
  error: string | null;
}

export function useVoice() {
  const [state, setState] = useState<VoiceHookState>({
    isRecording: false,
    level: 0,
    transcript: '',
    isTranscribing: false,
    error: null,
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<string>('');
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Start audio recording. Requests microphone permission, initializes MediaRecorder.
   */
  const startRecording = useCallback(async () => {
    try {
      setState((s) => ({ ...s, error: null }));

      // Get audio stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Setup audio context for level metering
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const source = audioContextRef.current.createMediaStreamSource(stream);
      const analyser = audioContextRef.current.createAnalyser();
      source.connect(analyser);

      analyserRef.current = analyser;

      // Start level monitoring
      const updateLevel = () => {
        if (!analyserRef.current) return;

        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArray);

        // Simple RMS calculation for level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += (dataArray[i] * dataArray[i]) / 255;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(100, Math.round(rms * 200));

        setState((s) => ({ ...s, level }));
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      animationFrameRef.current = requestAnimationFrame(updateLevel);

      // Setup MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recordingIdRef.current = self.crypto.randomUUID();

      // Signal main process
      if (typeof window !== 'undefined' && window.ultronos) {
        await window.ultronos.voice.start(recordingIdRef.current);
      }

      recorder.start();
      setState((s) => ({ ...s, isRecording: true, transcript: '', level: 0 }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, error: msg }));
      console.error('[useVoice] failed to start recording:', err);
    }
  }, []);

  /**
   * Stop recording, send blob to main process for transcription.
   * Returns transcript string.
   */
  const stopRecording = useCallback(async (): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorderRef.current || !mediaRecorderRef.current.stream) {
        reject(new Error('No recording in progress'));
        return;
      }

      setState((s) => ({ ...s, isTranscribing: true }));

      const recorder = mediaRecorderRef.current;
      const recordingId = recordingIdRef.current;

      // Stop stream
      recorder.stream.getTracks().forEach((track) => track.stop());

      // Cancel level updates
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      recorder.onstop = async () => {
        try {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const arrayBuffer = await audioBlob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);

          if (!window.ultronos) {
            throw new Error('ultronos IPC not available');
          }

          // Send to main process
          const result = await window.ultronos.voice.stop(recordingId, uint8Array);
          setState((s) => ({
            ...s,
            isRecording: false,
            isTranscribing: false,
            transcript: result.transcript,
          }));

          resolve(result.transcript);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          setState((s) => ({
            ...s,
            isRecording: false,
            isTranscribing: false,
            error: msg,
          }));
          reject(err);
        }
      };

      recorder.stop();
    });
  }, []);

  /**
   * Subscribe to voice events (partial, complete, error).
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ultronos?.voice) {
      return;
    }

    const unsubPartial = window.ultronos.voice.onPartial(({ partial }) => {
      setState((s) => ({
        ...s,
        transcript: (s.transcript || '') + partial,
      }));
    });

    const unsubComplete = window.ultronos.voice.onComplete(({ transcript }) => {
      setState((s) => ({
        ...s,
        transcript,
        isTranscribing: false,
      }));
    });

    const unsubError = window.ultronos.voice.onError(({ error }) => {
      setState((s) => ({
        ...s,
        error,
        isTranscribing: false,
      }));
    });

    return () => {
      unsubPartial();
      unsubComplete();
      unsubError();
    };
  }, []);

  /**
   * Hotkey: spacebar hold = record, release = stop.
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space or Ctrl+` for push-to-talk
      if ((e.code === 'Space' || e.code === 'Backquote') && e.ctrlKey) {
        if (!state.isRecording && !state.isTranscribing) {
          e.preventDefault();
          startRecording();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Backquote') && e.ctrlKey) {
        if (state.isRecording) {
          e.preventDefault();
          stopRecording().catch((err) => {
            console.error('[useVoice] error stopping:', err);
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [state.isRecording, state.isTranscribing, startRecording, stopRecording]);

  return {
    ...state,
    startRecording,
    stopRecording,
  };
}
