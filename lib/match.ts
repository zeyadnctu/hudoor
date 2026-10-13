// Fuzzy name matching for timetable import (dependency-free, unit-tested).
// Normalized Dice coefficient over character bigrams + token overlap.

export function normalize(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function bigrams(s: string): string[] {
  const t = `$${s}$`;
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2));
  return out;
}

export function dice(a: string, b: string): number {
  const A = normalize(a), B = normalize(b);
  if (!A || !B) return 0;
  if (A === B) return 1;
  const ba = bigrams(A), bb = bigrams(B);
  const counts = new Map<string, number>();
  for (const g of ba) counts.set(g, (counts.get(g) ?? 0) + 1);
  let hit = 0;
  for (const g of bb) {
    const c = counts.get(g) ?? 0;
    if (c > 0) { hit++; counts.set(g, c - 1); }
  }
  return (2 * hit) / (ba.length + bb.length);
}

export function tokenOverlap(a: string, b: string): number {
  const A = new Set(normalize(a).split(" ").filter(Boolean));
  const B = new Set(normalize(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.max(A.size, B.size);
}

/** Combined score 0..1 (bigrams carry spelling, tokens carry word order freedom). */
export function similarity(a: string, b: string): number {
  return Math.max(dice(a, b), tokenOverlap(a, b) * 0.95);
}

export type Candidate<T> = { item: T; score: number };

/** Best matches above threshold, sorted desc. `label` extracts the match text. */
export function bestMatches<T>(
  input: string, pool: T[], label: (t: T) => string,
  threshold = 0.55, limit = 3
): Candidate<T>[] {
  return pool
    .map(item => ({ item, score: similarity(input, label(item)) }))
    .filter(c => c.score >= threshold)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
