import type { AvgDurationBucket } from '../../data/fdp';

export type { AvgDurationBucket };

export type RestFacilityClass = 1 | 2 | 3;

export type SplitWindow =
  /** Break falls entirely 00:00–05:59 at the acclimatized location — 700.50(1)(a). */
  | 'overnight'
  /** Break falls 06:00–23:59 at the acclimatized location — 700.50(1)(b). */
  | 'day'
  /** FDP re-planned in flight because of an unforeseen operational circumstance — 700.50(1)(c). */
  | 'uoc-replan';

export type Acclimatization =
  | { state: 'acclimatized' }
  | {
      state: 'not-acclimatized';
      /**
       * Hours the zone you are still acclimatized to is AHEAD of where you now
       * report (positive) or BEHIND it (negative). The table is then read using
       * report time + this offset. AC 700-047 § 4.22.
       */
      acclimatizedZoneOffsetHours: number;
    };

export interface FdpInput {
  /** Local clock time the FDP starts, "HH:MM". */
  startTime: string;
  acclimatization: Acclimatization;
  /** Number of flights scheduled in the FDP (positioning legs don't count — 700.28(6)). */
  numFlights: number;
  avgDuration: AvgDurationBucket;
  /** All flights under day VFR — uses the 700.28(9) table. */
  dayVfr: boolean;
  /** Augmented crew + rest facility — 700.60 replaces the 700.28 maximum. */
  augmented?: { additionalCrew: 1 | 2; restFacility: RestFacilityClass };
  /** A split-duty break — 700.50 extends the maximum. */
  split?: { breakMinutes: number; window: SplitWindow };
}

export interface FdpStep {
  label: string;
  value: string;
  detail?: string;
  citation: string;
}

export interface FdpResult {
  /** Maximum flight duty period, in hours (may be fractional, e.g. 12.5). */
  maxFdpHours: number;
  /** Same value as "h:mm". */
  maxFdpFormatted: string;
  /** Ordered explanation, each step carrying its exact citation. */
  steps: FdpStep[];
  /** Every distinct citation referenced, in order of first appearance. */
  citations: string[];
  /** Cautions the user must weigh — not blockers. */
  warnings: string[];
}
