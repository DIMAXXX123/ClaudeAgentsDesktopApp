/**
 * Fuzzy search engine for CommandPaletteV2.
 * Score-based matching: contiguous bonus, start-of-word bonus, exact match bonus.
 * Returns sorted results with highlighted match ranges.
 */

export interface FuzzyMatch {
  /** 0-100, higher = better match */
  score: number;
  /** character indices in `text` that matched query chars */
  ranges: number[];
}

/**
 * Score `text` against `query` using a greedy fuzzy algorithm.
 * Returns null if not all query chars found in text.
 */
export function fuzzyScore(text: string, query: string): FuzzyMatch | null {
  if (!query) return { score: 100, ranges: [] };

  const t = text.toLowerCase();
  const q = query.toLowerCase();

  const ranges: number[] = [];
  let ti = 0;
  let qi = 0;

  // Find all query chars in order inside text
  while (qi < q.length && ti < t.length) {
    if (t[ti] === q[qi]) {
      ranges.push(ti);
      qi++;
    }
    ti++;
  }

  if (qi < q.length) return null; // not all chars matched

  // --- Scoring ---
  let score = 0;

  // Base score: ratio of matched chars to text length (prefer shorter texts)
  score += Math.round((q.length / t.length) * 40);

  // Contiguous bonus: runs of consecutive matched indices
  let run = 1;
  for (let i = 1; i < ranges.length; i++) {
    if (ranges[i] === ranges[i - 1] + 1) {
      run++;
    } else {
      run = 1;
    }
    score += run * 3;
  }

  // Start-of-word bonus: match at position 0 or after a separator
  const separators = new Set([" ", "-", "_", ".", "/"]);
  for (const idx of ranges) {
    if (idx === 0 || separators.has(t[idx - 1])) {
      score += 8;
    }
  }

  // Exact prefix bonus
  if (t.startsWith(q)) score += 25;

  // Exact match bonus
  if (t === q) score += 35;

  return { score: Math.min(score, 100), ranges };
}

export interface FuzzyItem<T> {
  item: T;
  key: string; // the string to match against
}

export interface FuzzyResult<T> {
  item: T;
  score: number;
  ranges: number[];
}

/**
 * Filter and rank a list of items by fuzzy match.
 * `getKey` extracts the string to match for each item.
 * Multiple keys can be combined: pass the highest-scoring one.
 */
export function fuzzyFilter<T>(
  items: T[],
  query: string,
  getKeys: (item: T) => string[],
): FuzzyResult<T>[] {
  if (!query.trim()) {
    return items.map((item) => ({ item, score: 0, ranges: [] }));
  }

  const results: FuzzyResult<T>[] = [];

  for (const item of items) {
    const keys = getKeys(item);
    let best: FuzzyMatch | null = null;

    for (const key of keys) {
      const m = fuzzyScore(key, query);
      if (m && (!best || m.score > best.score)) {
        best = m;
      }
    }

    if (best) {
      results.push({ item, score: best.score, ranges: best.ranges });
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Build a React-renderable array of spans from text + match ranges.
 * Returns segments: { text, highlight }
 */
export function buildHighlightSegments(
  text: string,
  ranges: number[],
): { text: string; highlight: boolean }[] {
  if (!ranges.length) return [{ text, highlight: false }];

  const rangeSet = new Set(ranges);
  const segments: { text: string; highlight: boolean }[] = [];
  let cur = "";
  let curHL = rangeSet.has(0);

  for (let i = 0; i < text.length; i++) {
    const hl = rangeSet.has(i);
    if (hl !== curHL) {
      if (cur) segments.push({ text: cur, highlight: curHL });
      cur = text[i];
      curHL = hl;
    } else {
      cur += text[i];
    }
  }
  if (cur) segments.push({ text: cur, highlight: curHL });

  return segments;
}
