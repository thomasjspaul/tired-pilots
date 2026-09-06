/**
 * CARs 700.28 — Maximum Flight Duty Period (703/704/705 operations).
 *
 * SINGLE SOURCE OF TRUTH. The rendered lookup tables on the Flight Duty Period
 * page and the FDP calculator (Stage 3) both read from here, so they can never
 * disagree. Every value is verified against the consolidated CARs on the Justice
 * Laws website (see CARS_RETRIEVED_ON) and cross-checked against the tables
 * carried over from the old Google Site.
 *
 * The three duration tables — 700.28(2)/(3)/(4) — share the same 9x3 grid of
 * hour values; only the flight-count column breakpoints differ. The day-VFR
 * table — 700.28(9) — has no flight-count dimension.
 */

import { cars, type Citation } from './citations';

export type AvgDurationBucket = 'lt30' | '30to50' | 'gte50';

export interface StartBand {
  id: string;
  /** e.g. "07:00–12:59" */
  label: string;
  /** inclusive, minutes from 00:00 */
  startMin: number;
  /** inclusive, minutes from 00:00 */
  endMin: number;
}

export interface FlightBand {
  id: string;
  /** e.g. "1 to 7 flights" */
  label: string;
  /** inclusive lower bound */
  min: number;
  /** inclusive upper bound, or null for "or more" */
  max: number | null;
}

/** The nine FDP start-time bands, shared by every 700.28 table. */
export const START_BANDS: readonly StartBand[] = [
  { id: '0000-0359', label: '00:00–03:59', startMin: 0, endMin: 239 },
  { id: '0400-0459', label: '04:00–04:59', startMin: 240, endMin: 299 },
  { id: '0500-0559', label: '05:00–05:59', startMin: 300, endMin: 359 },
  { id: '0600-0659', label: '06:00–06:59', startMin: 360, endMin: 419 },
  { id: '0700-1259', label: '07:00–12:59', startMin: 420, endMin: 779 },
  { id: '1300-1659', label: '13:00–16:59', startMin: 780, endMin: 1019 },
  { id: '1700-2159', label: '17:00–21:59', startMin: 1020, endMin: 1319 },
  { id: '2200-2259', label: '22:00–22:59', startMin: 1320, endMin: 1379 },
  { id: '2300-2359', label: '23:00–23:59', startMin: 1380, endMin: 1439 },
] as const;

/** Flight-count column breakpoints per duration table. */
export const FLIGHT_BANDS: Record<AvgDurationBucket, readonly FlightBand[]> = {
  lt30: [
    { id: 'a', label: '1 to 11 flights', min: 1, max: 11 },
    { id: 'b', label: '12 to 17 flights', min: 12, max: 17 },
    { id: 'c', label: '18 or more flights', min: 18, max: null },
  ],
  '30to50': [
    { id: 'a', label: '1 to 7 flights', min: 1, max: 7 },
    { id: 'b', label: '8 to 11 flights', min: 8, max: 11 },
    { id: 'c', label: '12 or more flights', min: 12, max: null },
  ],
  gte50: [
    { id: 'a', label: '1 to 4 flights', min: 1, max: 4 },
    { id: 'b', label: '5 or 6 flights', min: 5, max: 6 },
    { id: 'c', label: '7 or more flights', min: 7, max: null },
  ],
};

/**
 * Maximum FDP in hours, indexed [startBandIndex][flightBandIndex].
 * Identical grid for all three duration tables (700.28(2), (3) and (4)).
 */
const DURATION_GRID: readonly (readonly number[])[] = [
  [9, 9, 9], // 00:00–03:59
  [10, 9, 9], // 04:00–04:59
  [11, 10, 9], // 05:00–05:59
  [12, 11, 10], // 06:00–06:59
  [13, 12, 11], // 07:00–12:59
  [12.5, 11.5, 10.5], // 13:00–16:59
  [12, 11, 10], // 17:00–21:59
  [11, 10, 9], // 22:00–22:59
  [10, 9, 9], // 23:00–23:59
] as const;

export const FDP_TABLE: Record<AvgDurationBucket, readonly (readonly number[])[]> = {
  lt30: DURATION_GRID,
  '30to50': DURATION_GRID,
  gte50: DURATION_GRID,
};

/** 700.28(9) — flights conducted under day VFR. One value per start band. */
export const DAY_VFR_FDP: readonly number[] = [9, 10, 11, 12, 13, 12.5, 12, 11, 10] as const;

export const FDP_CITATION: Record<AvgDurationBucket, Citation> = {
  lt30: cars('700.28', '(2)'),
  '30to50': cars('700.28', '(3)'),
  gte50: cars('700.28', '(4)'),
};
export const DAY_VFR_CITATION: Citation = cars('700.28', '(9)');

export const DURATION_BUCKET_LABEL: Record<AvgDurationBucket, string> = {
  lt30: 'less than 30 minutes',
  '30to50': '30 minutes or more but less than 50 minutes',
  gte50: '50 minutes or more',
};

/** Find the start-time band for a clock time given as minutes from 00:00 (0–1439). */
export function resolveStartBand(minutesFromMidnight: number): StartBand {
  const m = ((Math.floor(minutesFromMidnight) % 1440) + 1440) % 1440;
  const band = START_BANDS.find((b) => m >= b.startMin && m <= b.endMin);
  // Every minute 0–1439 falls in exactly one band, but keep TS happy.
  return band ?? START_BANDS[0];
}

/** Find the flight-count band for a given number of flights in a duration table. */
export function resolveFlightBand(bucket: AvgDurationBucket, numFlights: number): FlightBand {
  const n = Math.max(1, Math.floor(numFlights));
  const bands = FLIGHT_BANDS[bucket];
  const band = bands.find((b) => n >= b.min && (b.max === null || n <= b.max));
  return band ?? bands[bands.length - 1];
}

export interface FdpLookup {
  hours: number;
  startBand: StartBand;
  /** null for the day-VFR table (no flight-count dimension). */
  flightBand: FlightBand | null;
  citation: Citation;
}

/**
 * Base maximum FDP from 700.28 before any adjustment (acclimatization is applied
 * by the caller to `startMinutes`; augmented crew and split duty are layered on
 * afterwards in Stage 3).
 */
export function lookupMaxFdp(opts: {
  startMinutes: number;
  numFlights: number;
  avgDuration: AvgDurationBucket;
  dayVfr?: boolean;
}): FdpLookup {
  const startBand = resolveStartBand(opts.startMinutes);
  const startIdx = START_BANDS.indexOf(startBand);

  if (opts.dayVfr) {
    return {
      hours: DAY_VFR_FDP[startIdx],
      startBand,
      flightBand: null,
      citation: DAY_VFR_CITATION,
    };
  }

  const flightBand = resolveFlightBand(opts.avgDuration, opts.numFlights);
  const flightIdx = FLIGHT_BANDS[opts.avgDuration].indexOf(flightBand);

  return {
    hours: FDP_TABLE[opts.avgDuration][startIdx][flightIdx],
    startBand,
    flightBand,
    citation: FDP_CITATION[opts.avgDuration],
  };
}

/** "13 hours" / "12.5 hours" -> "13:00" / "12:30". */
export function hoursToHHMM(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}
