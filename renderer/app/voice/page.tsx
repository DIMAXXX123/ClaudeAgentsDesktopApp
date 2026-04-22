'use client';

import { useState, useEffect } from 'react';
import { VoiceButton } from '@/components/VoiceButton';
import { parseSlashCommand, executeSlashCommand } from '@/lib/slashCommands';

interface CommandHistory {
  id: string;
  timestamp: number;
  transcript: string;
  command: string;
  status: 'pending' | 'success' | 'error';
  result?: string;
}

export default function VoicePage() {
  const [history, setHistory] = useState<CommandHistory[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    // Get active agent session on mount
    if (typeof window !== 'undefined' && window.ultronos?.agent) {
      window.ultronos.agent.list().then((agents) => {
        if (agents.length > 0) {
          setActiveSessionId(agents[0].sessionId);
        }
      });
    }
  }, []);

  const handleTranscript = async (transcript: string) => {
    const commandId = crypto.randomUUID();
    const now = Date.now();

    // Parse into slash command
    const command = parseSlashCommand(transcript);

    // Add to history
    setHistory((prev) => [
      {
        id: commandId,
        timestamp: now,
        transcript,
        command: command.cmd,
        status: 'pending',
      },
      ...prev,
    ]);

    // Execute command
    try {
      const result = await executeSlashCommand(command, activeSessionId ?? undefined);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === commandId
            ? {
              ...item,
              status: 'success',
              result: JSON.stringify(result, null, 2),
            }
            : item
        )
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setHistory((prev) =>
        prev.map((item) =>
          item.id === commandId
            ? {
              ...item,
              status: 'error',
              result: msg,
            }
            : item
        )
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex flex-col items-center justify-start p-6">
      {/* Header */}
      <div className="w-full max-w-2xl mb-12 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Voice Command</h1>
        <p className="text-gray-400">Hold spacebar or press Ctrl+` to record</p>
      </div>

      {/* Voice Button (centered, large) */}
      <div className="mb-16 scale-125">
        <VoiceButton onTranscript={handleTranscript} />
      </div>

      {/* Session Info */}
      {activeSessionId && (
        <div className="w-full max-w-2xl mb-8 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-300">
          <span className="font-mono">Session: {activeSessionId.slice(0, 8)}...</span>
        </div>
      )}

      {/* Command History */}
      <div className="w-full max-w-2xl">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Commands</h2>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No commands yet</p>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-gray-800/50 border-l-4 rounded-lg text-sm"
                style={{
                  borderColor:
                    item.status === 'success'
                      ? '#10b981'
                      : item.status === 'error'
                        ? '#ef4444'
                        : '#f59e0b',
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-gray-300">"{item.transcript}"</span>
                  <span className="text-xs px-2 py-1 rounded"
                    style={{
                      backgroundColor:
                        item.status === 'success'
                          ? 'rgba(16, 185, 129, 0.2)'
                          : item.status === 'error'
                            ? 'rgba(239, 68, 68, 0.2)'
                            : 'rgba(245, 158, 11, 0.2)',
                      color:
                        item.status === 'success'
                          ? '#10b981'
                          : item.status === 'error'
                            ? '#ef4444'
                            : '#f59e0b',
                    }}
                  >
                    {item.status}
                  </span>
                </div>
                <p className="text-gray-400 mb-2">
                  Command: <span className="font-mono text-blue-400">{item.command}</span>
                </p>
                {item.result && (
                  <details className="cursor-pointer">
                    <summary className="text-gray-500 hover:text-gray-400 text-xs">
                      Show result
                    </summary>
                    <pre className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {item.result}
                    </pre>
                  </details>
                )}
                <span className="text-xs text-gray-500 mt-2 block">
                  {new Date(item.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
