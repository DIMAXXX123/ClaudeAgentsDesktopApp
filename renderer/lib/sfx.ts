"use client";

let ctx: AudioContext | null = null;
let muted = false;

function getCtx() {
  if (typeof window === "undefined") return null;
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => undefined);
    }
    return ctx;
  } catch {
    return null;
  }
}

function beep({
  freq = 880,
  dur = 0.08,
  type = "square" as OscillatorType,
  gain = 0.05,
  sweepTo = 0,
}: {
  freq?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  sweepTo?: number;
}) {
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  try {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ac.currentTime);
    if (sweepTo) {
      osc.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + dur);
    }
    g.gain.setValueAtTime(gain, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
    osc.connect(g).connect(ac.destination);
    osc.start();
    osc.stop(ac.currentTime + dur);
  } catch {
    // Autoplay policy / suspended context — silently ignore.
  }
}

export const sfx = {
  toggleMute: () => {
    muted = !muted;
    return muted;
  },
  isMuted: () => muted,
  hover: () => beep({ freq: 1200, dur: 0.04, gain: 0.02 }),
  select: () => {
    beep({ freq: 660, dur: 0.06, gain: 0.04 });
    setTimeout(() => beep({ freq: 990, dur: 0.06, gain: 0.04 }), 50);
  },
  open: () => {
    beep({ freq: 300, sweepTo: 900, dur: 0.2, type: "sawtooth", gain: 0.05 });
  },
  close: () => {
    beep({ freq: 900, sweepTo: 300, dur: 0.18, type: "sawtooth", gain: 0.05 });
  },
  send: () => {
    beep({ freq: 1400, dur: 0.05, gain: 0.03 });
  },
  receive: () => {
    beep({ freq: 760, dur: 0.06, gain: 0.04 });
  },
  tool: () => {
    beep({ freq: 440, dur: 0.05, type: "triangle", gain: 0.04 });
    setTimeout(() => beep({ freq: 880, dur: 0.05, type: "triangle", gain: 0.04 }), 40);
  },
  error: () => {
    beep({ freq: 220, sweepTo: 110, dur: 0.25, type: "sawtooth", gain: 0.06 });
  },
  tab: () => beep({ freq: 520, dur: 0.04, type: "square", gain: 0.03 }),
};
