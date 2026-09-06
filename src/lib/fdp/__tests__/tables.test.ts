import { describe, expect, it } from 'vitest';
import {
  DAY_VFR_FDP,
  FDP_TABLE,
  FLIGHT_BANDS,
  START_BANDS,
  lookupMaxFdp,
  resolveFlightBand,
  resolveStartBand,
  type AvgDurationBucket,
} from '../../../data/fdp';
import {
  FLIGHT_COLUMN_LABELS,
  START_ROW_LABELS,
  TABLE_30TO50,
  TABLE_DAY_VFR,
  TABLE_GTE50,
  TABLE_LT30,
} from './fixtures';

const FIXTURE: Record<AvgDurationBucket, number[][]> = {
  lt30: TABLE_LT30,
  '30to50': TABLE_30TO50,
  gte50: TABLE_GTE50,
};

describe('700.28 table integrity — data module vs independent transcription', () => {
  it('has the nine start-time bands in order with the expected labels', () => {
    expect(START_BANDS.map((b) => b.label)).toEqual(START_ROW_LABELS);
  });

  for (const bucket of ['lt30', '30to50', 'gte50'] as const) {
    it(`700.28 ${bucket}: column headers match`, () => {
      expect(FLIGHT_BANDS[bucket].map((b) => b.label)).toEqual(FLIGHT_COLUMN_LABELS[bucket]);
    });

    it(`700.28 ${bucket}: every cell matches the fixture`, () => {
      const grid = FDP_TABLE[bucket];
      expect(grid.length).toBe(9);
      for (let r = 0; r < 9; r++) {
        expect(Array.from(grid[r])).toEqual(FIXTURE[bucket][r]);
      }
    });
  }

  it('700.28(9) day VFR: every cell matches the fixture', () => {
    expect(Array.from(DAY_VFR_FDP)).toEqual(TABLE_DAY_VFR);
  });
});

describe('700.28 band resolvers', () => {
  it('maps clock times to the right start band (incl. boundaries)', () => {
    expect(resolveStartBand(0).label).toBe('00:00–03:59'); // 00:00
    expect(resolveStartBand(239).label).toBe('00:00–03:59'); // 03:59
    expect(resolveStartBand(240).label).toBe('04:00–04:59'); // 04:00
    expect(resolveStartBand(6 * 60 - 1).label).toBe('05:00–05:59'); // 05:59
    expect(resolveStartBand(6 * 60).label).toBe('06:00–06:59'); // 06:00
    expect(resolveStartBand(7 * 60).label).toBe('07:00–12:59'); // 07:00
    expect(resolveStartBand(13 * 60 - 1).label).toBe('07:00–12:59'); // 12:59
    expect(resolveStartBand(13 * 60).label).toBe('13:00–16:59'); // 13:00
    expect(resolveStartBand(22 * 60).label).toBe('22:00–22:59'); // 22:00
    expect(resolveStartBand(23 * 60).label).toBe('23:00–23:59'); // 23:00
    expect(resolveStartBand(1439).label).toBe('23:00–23:59'); // 23:59
  });

  it('wraps out-of-range minutes into a 24h clock', () => {
    expect(resolveStartBand(1440).label).toBe('00:00–03:59');
    expect(resolveStartBand(-60).label).toBe('23:00–23:59');
  });

  it('maps flight counts to the right column per table', () => {
    expect(resolveFlightBand('30to50', 7).label).toBe('1 to 7 flights');
    expect(resolveFlightBand('30to50', 8).label).toBe('8 to 11 flights');
    expect(resolveFlightBand('30to50', 99).label).toBe('12 or more flights');
    expect(resolveFlightBand('gte50', 4).label).toBe('1 to 4 flights');
    expect(resolveFlightBand('gte50', 5).label).toBe('5 or 6 flights');
    expect(resolveFlightBand('lt30', 17).label).toBe('12 to 17 flights');
    expect(resolveFlightBand('lt30', 18).label).toBe('18 or more flights');
  });
});

describe('lookupMaxFdp', () => {
  it('acclimatized, 07:00 report, 6 flights averaging 40 min -> 13 hours (700.28(3))', () => {
    const r = lookupMaxFdp({ startMinutes: 7 * 60, numFlights: 6, avgDuration: '30to50' });
    expect(r.hours).toBe(13);
    expect(r.citation.label).toBe('CARs 700.28(3)');
    expect(r.startBand.label).toBe('07:00–12:59');
    expect(r.flightBand?.label).toBe('1 to 7 flights');
  });

  it('13:30 report, 9 short flights, avg < 30 min -> 12.5 h (700.28(2), 1–11 col)', () => {
    const r = lookupMaxFdp({ startMinutes: 13 * 60 + 30, numFlights: 9, avgDuration: 'lt30' });
    expect(r.hours).toBe(12.5);
    expect(r.citation.label).toBe('CARs 700.28(2)');
    expect(r.flightBand?.label).toBe('1 to 11 flights');
  });

  it('13:30 report, 14 short flights, avg < 30 min -> 11.5 h (700.28(2), 12–17 col)', () => {
    const r = lookupMaxFdp({ startMinutes: 13 * 60 + 30, numFlights: 14, avgDuration: 'lt30' });
    expect(r.hours).toBe(11.5);
    expect(r.flightBand?.label).toBe('12 to 17 flights');
  });

  it('day VFR ignores flight count and uses 700.28(9)', () => {
    const r = lookupMaxFdp({
      startMinutes: 7 * 60,
      numFlights: 20,
      avgDuration: 'gte50',
      dayVfr: true,
    });
    expect(r.hours).toBe(13);
    expect(r.flightBand).toBeNull();
    expect(r.citation.label).toBe('CARs 700.28(9)');
  });

  it('early-morning start is the most restrictive row', () => {
    const r = lookupMaxFdp({ startMinutes: 2 * 60, numFlights: 2, avgDuration: 'gte50' });
    expect(r.hours).toBe(9);
    expect(r.startBand.label).toBe('00:00–03:59');
  });
});
