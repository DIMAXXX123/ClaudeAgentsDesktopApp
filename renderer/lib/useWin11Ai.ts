'use client';

import { useEffect, useState, useCallback } from 'react';

type OcrResult = { text: string; lines?: Array<{ text: string; bbox?: unknown }> };
type SummarizeResult = { summary: string };
type DescribeResult = { description: string };
type GenerateResult = { text: string };
type ErrorResult = { error: string; detail?: string };

interface Win11AiContext {
  available: boolean | null;
  ocr: (imagePath: string) => Promise<OcrResult | ErrorResult>;
  summarize: (text: string) => Promise<SummarizeResult | ErrorResult>;
  describe: (imagePath: string) => Promise<DescribeResult | ErrorResult>;
  generate: (prompt: string) => Promise<GenerateResult | ErrorResult>;
}

/**
 * Hook to access Windows 11 AI runtime from renderer.
 * Returns null context if Win11 AI API is not exposed by preload.
 */
export function useWin11Ai(): Win11AiContext {
  const [available, setAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAvailability = async () => {
      if (typeof window !== 'undefined' && window.ultronos?.win11ai) {
        try {
          const isAvailable = await window.ultronos.win11ai.available();
          setAvailable(isAvailable);
        } catch (err) {
          console.error('Error checking Win11 AI availability:', err);
          setAvailable(false);
        }
      } else {
        setAvailable(false);
      }
    };

    checkAvailability();
  }, []);

  const ocr = useCallback(async (imagePath: string): Promise<OcrResult | ErrorResult> => {
    if (!window.ultronos?.win11ai) {
      return { error: 'not_available', detail: 'Win11 AI API not available' };
    }
    try {
      return await window.ultronos.win11ai.ocr(imagePath);
    } catch (err) {
      return {
        error: 'ocr_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  const summarize = useCallback(async (text: string): Promise<SummarizeResult | ErrorResult> => {
    if (!window.ultronos?.win11ai) {
      return { error: 'not_available', detail: 'Win11 AI API not available' };
    }
    try {
      return await window.ultronos.win11ai.summarize(text);
    } catch (err) {
      return {
        error: 'summarize_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  const describe = useCallback(async (imagePath: string): Promise<DescribeResult | ErrorResult> => {
    if (!window.ultronos?.win11ai) {
      return { error: 'not_available', detail: 'Win11 AI API not available' };
    }
    try {
      return await window.ultronos.win11ai.describe(imagePath);
    } catch (err) {
      return {
        error: 'describe_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  const generate = useCallback(async (prompt: string): Promise<GenerateResult | ErrorResult> => {
    if (!window.ultronos?.win11ai) {
      return { error: 'not_available', detail: 'Win11 AI API not available' };
    }
    try {
      return await window.ultronos.win11ai.generate(prompt);
    } catch (err) {
      return {
        error: 'generate_error',
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }, []);

  return {
    available,
    ocr,
    summarize,
    describe,
    generate,
  };
}
