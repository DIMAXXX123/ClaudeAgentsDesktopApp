'use client';

import { useEffect, useState } from 'react';

type FeedChannel = 'conductor-heartbeat' | 'conductor-plan' | 'scout' | 'tg' | 'listener-sessions';

export function useLiveFeed<T = unknown>(channel: FeedChannel): T | null {
  const [data, setData] = useState<T | null>(null);

  useEffect(() => {
    // Type guard for window.ultronos
    const ultronos = (typeof window !== 'undefined' ? (window as any).ultronos : undefined) as
      | { feed: { on: (ch: string, cb: (data: unknown) => void) => () => void } }
      | undefined;

    if (!ultronos?.feed) {
      return;
    }

    const unsub = ultronos.feed.on(channel, (incoming: unknown) => {
      setData(incoming as T);
    });

    return unsub;
  }, [channel]);

  return data;
}
