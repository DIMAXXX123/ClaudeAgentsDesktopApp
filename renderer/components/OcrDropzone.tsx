'use client';

import { useState, useRef, useCallback } from 'react';

import { useWin11Ai } from '@/lib/useWin11Ai';

interface OcrDropzoneProps {
  onExtractedText?: (text: string) => void;
  disabled?: boolean;
}

/**
 * OCR Dropzone component.
 * Allows drag-and-drop or file input to extract text from images.
 * Falls back gracefully if Win11 AI is not available.
 */
export function OcrDropzone({ onExtractedText, disabled = false }: OcrDropzoneProps) {
  const { ocr, available } = useWin11Ai();
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processImage = useCallback(
    async (filePath: string) => {
      if (!available) {
        setError('Win11 AI not available on this system');
        return;
      }

      setIsProcessing(true);
      setError(null);

      try {
        const result = await ocr(filePath);

        if ('error' in result) {
          setError(`OCR Error: ${result.error}${result.detail ? ` (${result.detail})` : ''}`);
          setExtractedText('');
        } else {
          setExtractedText(result.text);
          onExtractedText?.(result.text);
        }
      } catch (err) {
        setError(`Failed to process image: ${err instanceof Error ? err.message : String(err)}`);
        setExtractedText('');
      } finally {
        setIsProcessing(false);
      }
    },
    [ocr, available, onExtractedText]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !available) return;
      e.preventDefault();
      setIsDragging(true);
    },
    [disabled, available]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (disabled || !available) return;
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          const filePath = (file as any).path;
          if (filePath) {
            processImage(filePath);
          } else {
            setError('Unable to access file path. Use file input instead.');
          }
        } else {
          setError('Please drop an image file');
        }
      }
    },
    [disabled, available, processImage]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.currentTarget.files;
      if (files && files.length > 0) {
        const file = files[0];
        const filePath = (file as any).path;
        if (filePath) {
          processImage(filePath);
        } else {
          setError('Unable to access file path in this context');
        }
      }
    },
    [processImage]
  );

  if (!available) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Windows 11 AI Runtime is not available on this system.
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
          OCR requires Windows 11 build 26100+ with winrt-runtime package installed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-gray-900'
        } ${disabled || isProcessing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {isProcessing ? 'Processing image...' : 'Drag and drop image here to extract text'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">or</p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isProcessing}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Select Image File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled || isProcessing}
          />
        </div>
      </div>

      {error && <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 p-3 rounded">{error}</div>}

      {extractedText && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Extracted Text</label>
          <textarea
            value={extractedText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
              setExtractedText(e.target.value);
              onExtractedText?.(e.target.value);
            }}
            placeholder="Extracted text will appear here..."
            className="w-full font-mono text-sm p-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            rows={6}
          />
          <div className="flex gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(extractedText);
              }}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Copy to Clipboard
            </button>
            <button
              onClick={() => {
                setExtractedText('');
                setError(null);
              }}
              className="px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
