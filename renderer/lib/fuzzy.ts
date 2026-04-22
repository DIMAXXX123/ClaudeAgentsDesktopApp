/**
 * Simple fuzzy scoring without dependencies.
 * Prioritizes: substring match > startsWith > initials
 */

export function fuzzyScore(text: string, query: string): number {
  if (!query) return 100;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact match
  if (lowerText === lowerQuery) return 1000;

  // Substring match
  if (lowerText.includes(lowerQuery)) return 500;

  // Starts with
  if (lowerText.startsWith(lowerQuery)) return 400;

  // Initials match (first letter of each word)
  const words = lowerText.split(/\s+/);
  const initials = words.map((w) => w[0]).join('');
  if (initials.includes(lowerQuery) || matchInitials(initials, lowerQuery)) return 200;

  // Character-by-character distance (poor match)
  let score = 0;
  let queryIdx = 0;
  for (let i = 0; i < lowerText.length && queryIdx < lowerQuery.length; i++) {
    if (lowerText[i] === lowerQuery[queryIdx]) {
      score += 10;
      queryIdx++;
    }
  }

  return queryIdx === lowerQuery.length ? score : 0;
}

function matchInitials(initials: string, query: string): boolean {
  let qIdx = 0;
  for (let i = 0; i < initials.length && qIdx < query.length; i++) {
    if (initials[i] === query[qIdx]) {
      qIdx++;
    }
  }
  return qIdx === query.length;
}

export interface Rankable {
  title: string;
  keywords?: string[];
}

export function rankCommands<T extends Rankable>(cmds: T[], query: string): T[] {
  if (!query.trim()) return cmds;

  const scored = cmds.map((cmd) => {
    const titleScore = fuzzyScore(cmd.title, query);
    const keywordScore = (cmd.keywords || []).reduce((max, kw) => Math.max(max, fuzzyScore(kw, query)), 0);
    const maxScore = Math.max(titleScore, keywordScore);

    return { cmd, score: maxScore };
  });

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ cmd }) => cmd);
}
