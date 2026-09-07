import { describe, expect, it } from 'vitest';
import { wordDiff } from '../diff';

/** Re-join a diff, taking only the `same`+`add` parts, to reconstruct `b`. */
const rebuildB = (parts: ReturnType<typeof wordDiff>) =>
  parts
    .filter((p) => p.type !== 'del')
    .map((p) => p.text)
    .join('');
const rebuildA = (parts: ReturnType<typeof wordDiff>) =>
  parts
    .filter((p) => p.type !== 'add')
    .map((p) => p.text)
    .join('');

describe('wordDiff', () => {
  it('marks an identical string as all "same"', () => {
    const d = wordDiff('the quick brown fox', 'the quick brown fox');
    expect(d).toEqual([{ type: 'same', text: 'the quick brown fox' }]);
  });

  it('detects a pure insertion', () => {
    const d = wordDiff('the fox', 'the quick fox');
    expect(d.map((p) => p.type)).toContain('add');
    expect(d.some((p) => p.type === 'del')).toBe(false);
    expect(rebuildB(d)).toBe('the quick fox');
    expect(rebuildA(d)).toBe('the fox');
  });

  it('detects a pure deletion', () => {
    const d = wordDiff('the quick brown fox', 'the fox');
    expect(d.some((p) => p.type === 'del')).toBe(true);
    expect(d.some((p) => p.type === 'add')).toBe(false);
    expect(rebuildB(d)).toBe('the fox');
  });

  it('detects a replacement as a del + add', () => {
    const d = wordDiff('a b c', 'a x c');
    expect(d.some((p) => p.type === 'del' && p.text.includes('b'))).toBe(true);
    expect(d.some((p) => p.type === 'add' && p.text.includes('x'))).toBe(true);
  });

  it('always reconstructs both inputs exactly (incl. whitespace)', () => {
    const a = 'You report at 07:00.  Toronto is two zones east.\nUse the earlier row.';
    const b = 'You report at 07:00 in Toronto, two zones east, so use the earlier row.';
    const d = wordDiff(a, b);
    expect(rebuildA(d)).toBe(a);
    expect(rebuildB(d)).toBe(b);
  });

  it('handles an empty original', () => {
    const d = wordDiff('', 'brand new text');
    expect(d).toEqual([{ type: 'add', text: 'brand new text' }]);
  });
});
