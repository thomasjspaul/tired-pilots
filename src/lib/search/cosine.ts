/** Cosine similarity of two equal-length vectors (assumed non-zero). */
export function cosine(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export interface Vectorised<T> {
  item: T;
  vec: readonly number[];
}

/** Top-k items by cosine similarity to `query`, with the score attached. */
export function topK<T>(
  query: readonly number[],
  items: readonly Vectorised<T>[],
  k: number,
  minScore = 0,
): { item: T; score: number }[] {
  return items
    .map(({ item, vec }) => ({ item, score: cosine(query, vec) }))
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}
