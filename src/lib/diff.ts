/**
 * A minimal word-level diff for the /rewrite tool's "Show changes" view.
 * Splits both strings on whitespace boundaries (keeping the whitespace), runs a
 * longest-common-subsequence pass, and returns a flat list of runs. Not a
 * general-purpose diff — just enough to show a human what an edit touched.
 */
export type DiffPart = { type: 'same' | 'add' | 'del'; text: string };

/** Split into tokens that alternate word / whitespace, so re-joining is exact. */
function tokenize(s: string): string[] {
  return s.match(/\s+|\S+/g) ?? [];
}

export function wordDiff(a: string, b: string): DiffPart[] {
  const A = tokenize(a);
  const B = tokenize(b);
  const n = A.length;
  const m = B.length;

  // LCS length table.
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = A[i] === B[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  // Walk the table, emitting runs.
  const out: DiffPart[] = [];
  const push = (type: DiffPart['type'], text: string) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ type, text });
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      push('same', A[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push('del', A[i]);
      i++;
    } else {
      push('add', B[j]);
      j++;
    }
  }
  while (i < n) push('del', A[i++]);
  while (j < m) push('add', B[j++]);

  return out;
}
