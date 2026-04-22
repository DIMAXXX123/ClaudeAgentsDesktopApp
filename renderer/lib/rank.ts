export type Rank = {
  key: "recruit" | "operator" | "specialist" | "commander" | "sovereign";
  label: string;
  color: string;
  minLevel: number;
  // Replika-style affinity description — unlocked at each tier
  affinity: string;
};

export const RANKS: Rank[] = [
  {
    key: "recruit",
    label: "RECRUIT",
    color: "#8aa0c2",
    minLevel: 0,
    affinity: "just met — polite, by-the-book",
  },
  {
    key: "operator",
    label: "OPERATOR",
    color: "#22e8ff",
    minLevel: 3,
    affinity: "comfortable — skips preamble, uses shortcuts",
  },
  {
    key: "specialist",
    label: "SPECIALIST",
    color: "#22ff88",
    minLevel: 6,
    affinity: "in sync — anticipates follow-ups, delegates naturally",
  },
  {
    key: "commander",
    label: "COMMANDER",
    color: "#ffae3a",
    minLevel: 10,
    affinity: "tight bond — talks shop, no filler, deep context",
  },
  {
    key: "sovereign",
    label: "SOVEREIGN",
    color: "#ff4adf",
    minLevel: 15,
    affinity: "telepathic — one-word briefs, full plans executed",
  },
];

export function levelFromCounters(messagesSent: number, toolsUsed: number): number {
  return Math.floor(Math.sqrt(messagesSent + toolsUsed * 2));
}

export function xpValue(messagesSent: number, toolsUsed: number): number {
  return messagesSent + toolsUsed * 2;
}

export function xpForLevel(level: number): number {
  return level * level;
}

export function rankFromLevel(level: number): Rank {
  let current = RANKS[0];
  for (const r of RANKS) {
    if (level >= r.minLevel) current = r;
  }
  return current;
}

export function nextRank(level: number): Rank | null {
  for (const r of RANKS) {
    if (r.minLevel > level) return r;
  }
  return null;
}

export function progressInLevel(xp: number, level: number): number {
  const cur = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const span = Math.max(1, next - cur);
  return Math.max(0, Math.min(1, (xp - cur) / span));
}

// Capability milestones — cosmetic "unlocks" shown in memory panel
export type Milestone = { at: number; label: string };
export const MILESTONES: Milestone[] = [
  { at: 1, label: "FIRST CONTACT" },
  { at: 5, label: "TRUSTED OPERATOR" },
  { at: 10, label: "TEAM LEAD" },
  { at: 25, label: "VETERAN" },
  { at: 50, label: "LEGEND" },
  { at: 100, label: "MYTH" },
];

export function unlockedMilestones(messagesSent: number): Milestone[] {
  return MILESTONES.filter((m) => messagesSent >= m.at);
}
