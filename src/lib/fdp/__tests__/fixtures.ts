/**
 * Independently hand-transcribed copy of the CARs 700.28 tables, taken from the
 * table images carried over from the old site and confirmed against the
 * consolidated CARs on the Justice Laws website (retrieved 2026-01-15).
 *
 * This file must NOT import from src/data — the whole point is that it is a
 * second, separate transcription that `tables.test.ts` checks the data module
 * against, cell for cell.
 */

export const START_ROW_LABELS = [
  '00:00–03:59',
  '04:00–04:59',
  '05:00–05:59',
  '06:00–06:59',
  '07:00–12:59',
  '13:00–16:59',
  '17:00–21:59',
  '22:00–22:59',
  '23:00–23:59',
];

export const FLIGHT_COLUMN_LABELS = {
  lt30: ['1 to 11 flights', '12 to 17 flights', '18 or more flights'],
  '30to50': ['1 to 7 flights', '8 to 11 flights', '12 or more flights'],
  gte50: ['1 to 4 flights', '5 or 6 flights', '7 or more flights'],
};

// 700.28(2) — average flight duration LESS THAN 30 MINUTES
export const TABLE_LT30: number[][] = [
  [9, 9, 9],
  [10, 9, 9],
  [11, 10, 9],
  [12, 11, 10],
  [13, 12, 11],
  [12.5, 11.5, 10.5],
  [12, 11, 10],
  [11, 10, 9],
  [10, 9, 9],
];

// 700.28(3) — 30 MINUTES OR MORE BUT LESS THAN 50 MINUTES
export const TABLE_30TO50: number[][] = [
  [9, 9, 9],
  [10, 9, 9],
  [11, 10, 9],
  [12, 11, 10],
  [13, 12, 11],
  [12.5, 11.5, 10.5],
  [12, 11, 10],
  [11, 10, 9],
  [10, 9, 9],
];

// 700.28(4) — 50 MINUTES OR MORE
export const TABLE_GTE50: number[][] = [
  [9, 9, 9],
  [10, 9, 9],
  [11, 10, 9],
  [12, 11, 10],
  [13, 12, 11],
  [12.5, 11.5, 10.5],
  [12, 11, 10],
  [11, 10, 9],
  [10, 9, 9],
];

// 700.28(9) — flights conducted under DAY VFR
export const TABLE_DAY_VFR: number[] = [9, 10, 11, 12, 13, 12.5, 12, 11, 10];
