import { describe, expect, it } from 'vitest';
import { offsetHoursBetween, zoneOffsetMinutes } from '../timezones';

const JAN = new Date('2026-01-15T12:00:00Z');
const JUL = new Date('2026-07-15T12:00:00Z');

describe('zoneOffsetMinutes', () => {
  it('gives standard-time offsets in January', () => {
    expect(zoneOffsetMinutes('America/Toronto', JAN)).toBe(-300); // EST
    expect(zoneOffsetMinutes('America/Edmonton', JAN)).toBe(-420); // MST
    expect(zoneOffsetMinutes('America/Halifax', JAN)).toBe(-240); // AST
    expect(zoneOffsetMinutes('America/Vancouver', JAN)).toBe(-480); // PST
    expect(zoneOffsetMinutes('UTC', JAN)).toBe(0);
  });
  it('gives daylight offsets in July', () => {
    expect(zoneOffsetMinutes('America/Toronto', JUL)).toBe(-240); // EDT
    expect(zoneOffsetMinutes('America/Regina', JUL)).toBe(-360); // no DST -> still CST
  });
  it('returns NaN for a bogus zone', () => {
    expect(Number.isNaN(zoneOffsetMinutes('Not/AZone'))).toBe(true);
  });
});

describe('offsetHoursBetween — the AC 700-047 § 4.22 examples', () => {
  it('acclimatized Calgary, reporting Toronto -> -2 (year round)', () => {
    expect(offsetHoursBetween('America/Edmonton', 'America/Toronto', JAN)).toBe(-2);
    expect(offsetHoursBetween('America/Edmonton', 'America/Toronto', JUL)).toBe(-2);
  });
  it('acclimatized Halifax, reporting Vancouver -> +4 (year round)', () => {
    expect(offsetHoursBetween('America/Halifax', 'America/Vancouver', JAN)).toBe(4);
    expect(offsetHoursBetween('America/Halifax', 'America/Vancouver', JUL)).toBe(4);
  });
  it('same zone -> 0', () => {
    expect(offsetHoursBetween('America/Toronto', 'America/Toronto', JAN)).toBe(0);
  });
  it('a DST vs non-DST pair differs by season', () => {
    // Acclimatized Regina (no DST), reporting Winnipeg (DST): same clock in
    // winter; in summer Regina stays on CST so it's 1 h behind Winnipeg.
    expect(offsetHoursBetween('America/Regina', 'America/Winnipeg', JAN)).toBe(0);
    expect(offsetHoursBetween('America/Regina', 'America/Winnipeg', JUL)).toBe(-1);
  });
  it('NaN inputs collapse to 0 via the caller', () => {
    expect(Number.isNaN(offsetHoursBetween('bad', 'America/Toronto'))).toBe(true);
  });
});
