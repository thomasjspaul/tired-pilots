import { describe, expect, it } from 'vitest';
import { calculateMaxFdp } from '../calculate';
import { applySplitDuty } from '../../../data/splitDuty';
import { effectiveStartMinutes } from '../acclimatization';
import { parseClock } from '../format';
import type { FdpInput } from '../types';

const ACC: FdpInput['acclimatization'] = { state: 'acclimatized' };

/** Convenience: a fully-specified input with sensible defaults. */
const input = (over: Partial<FdpInput>): FdpInput => ({
  startTime: '07:00',
  acclimatization: ACC,
  numFlights: 2,
  avgDuration: 'gte50',
  dayVfr: false,
  ...over,
});

describe('acclimatization → effective table start time (AC 700-047 § 4.22)', () => {
  it('acclimatized: uses local report time', () => {
    expect(effectiveStartMinutes(parseClock('07:00'), ACC).minutes).toBe(7 * 60);
  });

  it('Calgary-acclimatized, reporting Toronto 07:00 → 05:00 (zone 2 h behind)', () => {
    const e = effectiveStartMinutes(parseClock('07:00'), {
      state: 'not-acclimatized',
      acclimatizedZoneOffsetHours: -2,
    });
    expect(e.minutes).toBe(5 * 60);
  });

  it('Halifax-acclimatized, reporting Vancouver 07:00 → 11:00 (zone 4 h ahead)', () => {
    const e = effectiveStartMinutes(parseClock('07:00'), {
      state: 'not-acclimatized',
      acclimatizedZoneOffsetHours: 4,
    });
    expect(e.minutes).toBe(11 * 60);
  });

  it('wraps around midnight', () => {
    const e = effectiveStartMinutes(parseClock('01:00'), {
      state: 'not-acclimatized',
      acclimatizedZoneOffsetHours: -3,
    });
    expect(e.minutes).toBe(22 * 60); // 01:00 − 3 h = 22:00
  });
});

describe('base 700.28 lookup via calculateMaxFdp', () => {
  it('07:00 report, 2 flights ≥50 min, acclimatized → 13:00 (700.28(4))', () => {
    const r = calculateMaxFdp(input({ startTime: '07:00', numFlights: 2, avgDuration: 'gte50' }));
    expect(r.maxFdpFormatted).toBe('13:00');
    expect(r.citations).toContain('CARs 700.28(4)');
  });

  it('continuous-duty explainer: 21:00 report, 2 flights ≥50 min → 12:00 (700.28(4), 1–4 col)', () => {
    const r = calculateMaxFdp(input({ startTime: '21:00', numFlights: 2, avgDuration: 'gte50' }));
    expect(r.maxFdpHours).toBe(12);
    expect(r.maxFdpFormatted).toBe('12:00');
  });

  it('non-acclimatized shifts the row: Calgary→Toronto 07:00, 4 flights 30–50 min → 11:00', () => {
    // effective start 05:00 → 700.28(3) row 05:00–05:59, "1 to 7 flights" = 11 h
    const r = calculateMaxFdp(
      input({
        startTime: '07:00',
        numFlights: 4,
        avgDuration: '30to50',
        acclimatization: { state: 'not-acclimatized', acclimatizedZoneOffsetHours: -2 },
      }),
    );
    expect(r.maxFdpFormatted).toBe('11:00');
    expect(r.warnings.some((w) => w.includes('AC 700-047 § 4.22'))).toBe(true);
  });

  it('day VFR uses 700.28(9) and ignores the flight count', () => {
    const r = calculateMaxFdp(input({ startTime: '07:00', numFlights: 20, dayVfr: true }));
    expect(r.maxFdpFormatted).toBe('13:00');
    expect(r.citations).toContain('CARs 700.28(9)');
  });

  it('band boundary: 05:59 vs 06:00 report give different rows', () => {
    const a = calculateMaxFdp(input({ startTime: '05:59', numFlights: 2, avgDuration: 'gte50' }));
    const b = calculateMaxFdp(input({ startTime: '06:00', numFlights: 2, avgDuration: 'gte50' }));
    expect(a.maxFdpFormatted).toBe('11:00'); // 05:00–05:59 row
    expect(b.maxFdpFormatted).toBe('12:00'); // 06:00–06:59 row
  });
});

describe('augmented crew (700.60) replaces the base', () => {
  it('2 additional crew + class 1 → 18:00 regardless of the base', () => {
    const r = calculateMaxFdp(input({ augmented: { additionalCrew: 2, restFacility: 1 } }));
    expect(r.maxFdpFormatted).toBe('18:00');
    expect(r.citations).toContain('CARs 700.60(1)');
  });

  it('1 additional crew + class 3 → 14:00', () => {
    const r = calculateMaxFdp(input({ augmented: { additionalCrew: 1, restFacility: 3 } }));
    expect(r.maxFdpFormatted).toBe('14:00');
  });

  it('warns when more than three flights are scheduled (700.60(2))', () => {
    const r = calculateMaxFdp(
      input({ numFlights: 5, augmented: { additionalCrew: 2, restFacility: 2 } }),
    );
    expect(r.warnings.some((w) => w.includes('three flights or fewer'))).toBe(true);
  });
});

describe('split flight duty (700.50)', () => {
  // splits-explained explainer worked examples
  it('60-min break, day → +7.5 min', () => {
    expect(applySplitDuty(60, 'day').extensionMinutes).toBe(7.5);
  });
  it('60-min break, overnight → +15 min', () => {
    expect(applySplitDuty(60, 'overnight').extensionMinutes).toBe(15);
  });
  it('240-min break, overnight → +195 min', () => {
    expect(applySplitDuty(240, 'overnight').extensionMinutes).toBe(195);
  });
  it('240-min break, day → +97.5 min', () => {
    expect(applySplitDuty(240, 'day').extensionMinutes).toBe(97.5);
  });
  it('below the 60-minute minimum is flagged', () => {
    expect(applySplitDuty(30, 'overnight').belowMinimum).toBe(true);
  });

  it('continuous-duty explainer: 21:00 / 2 flights + 3 h overnight break → 14:15', () => {
    const r = calculateMaxFdp(
      input({
        startTime: '21:00',
        numFlights: 2,
        avgDuration: 'gte50',
        split: { breakMinutes: 180, window: 'overnight' },
      }),
    );
    // 12:00 base + (180−45)×100% = 135 min → 14:15
    expect(r.maxFdpFormatted).toBe('14:15');
    expect(r.maxFdpHours).toBeCloseTo(14.25, 5);
  });

  it('never reduces the FDP', () => {
    const withSplit = calculateMaxFdp(input({ split: { breakMinutes: 60, window: 'day' } }));
    const without = calculateMaxFdp(input({}));
    expect(withSplit.maxFdpHours).toBeGreaterThanOrEqual(without.maxFdpHours);
  });
});

describe('absolute 18-hour ceiling (700.62(1))', () => {
  it('augmented 18:00 + a split is capped at 18:00 with a warning', () => {
    const r = calculateMaxFdp(
      input({
        augmented: { additionalCrew: 2, restFacility: 1 },
        split: { breakMinutes: 240, window: 'overnight' },
      }),
    );
    expect(r.maxFdpFormatted).toBe('18:00');
    expect(r.citations).toContain('CARs 700.62(1)');
    expect(r.warnings.some((w) => w.includes('18-hour'))).toBe(true);
  });
});

describe('step trace', () => {
  it('every step carries a citation and the citations list is deduped', () => {
    const r = calculateMaxFdp(
      input({
        acclimatization: { state: 'not-acclimatized', acclimatizedZoneOffsetHours: -2 },
        split: { breakMinutes: 120, window: 'day' },
      }),
    );
    for (const s of r.steps) expect(s.citation.length).toBeGreaterThan(0);
    expect(new Set(r.citations).size).toBe(r.citations.length);
  });
});
