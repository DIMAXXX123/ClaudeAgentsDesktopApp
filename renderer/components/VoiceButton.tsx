'use client';

import { useVoice } from '@/lib/useVoice';
import { cn } from '@/lib/cn';
import { Mic, AlertCircle } from 'lucide-react';

export interface VoiceButtonProps {
  onTranscript?: (text: string) => void;
  className?: string;
}

export function VoiceButton({ onTranscript, className }: VoiceButtonProps) {
  const voice = useVoice();

  const handleClick = async () => {
    if (voice.isRecording) {
      const transcript = await voice.stopRecording();
      onTranscript?.(transcript);
    } else {
      await voice.startRecording();
    }
  };

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <button
        onClick={handleClick}
        disabled={voice.isTranscribing}
        className={cn(
          'relative w-16 h-16 rounded-full flex items-center justify-center transition-all',
          voice.isRecording
            ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
            : voice.isTranscribing
              ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50 cursor-wait'
              : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/50',
          'text-white font-semibold disabled:opacity-50'
        )}
        title={
          voice.isRecording
            ? 'Release to stop recording'
            : voice.isTranscribing
              ? 'Transcribing...'
              : 'Hold to record voice or press Ctrl+`'
        }
      >
        <Mic className="w-6 h-6" />

        {voice.isRecording && (
          <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-pulse" />
        )}
      </button>

      {/* Volume Level Indicator */}
      {voice.isRecording && (
        <div className="w-24 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all"
            style={{ width: `${voice.level}%` }}
          />
        </div>
      )}

      {/* Transcript Display */}
      {voice.transcript && (
        <div className="text-sm text-gray-300 text-center max-w-xs">
          <p className="italic">"{voice.transcript}"</p>
        </div>
      )}

      {/* Error Display */}
      {voice.error && (
        <div className="flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{voice.error}</span>
        </div>
      )}

      {/* Status Text */}
      {voice.isTranscribing && (
        <p className="text-xs text-yellow-400 animate-pulse">Transcribing...</p>
      )}
    </div>
  );
}
