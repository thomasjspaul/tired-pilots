/**
 * CARs 700.60 — Maximum Flight Duty Period with an augmented flight crew and a
 * rest facility. Single source of truth for the rendered table and the Stage 3
 * calculator adjustment. Verified against laws-lois (SOR/96-433) and the table
 * image from the old site.
 */

import { cars, type Citation } from './citations';

export type RestFacilityClass = 1 | 2 | 3;

export interface AugmentedCrewRow {
  /** Maximum flight duty period, hours. */
  maxFdpHours: number;
  /** Additional flight crew members required (beyond the basic crew). */
  additionalCrew: 1 | 2;
  /** Acceptable rest facility class(es) for this row. */
  restFacility: RestFacilityClass[];
  /** Human label for the rest-facility cell. */
  restFacilityLabel: string;
  citation: Citation;
}

export const AUGMENTED_CREW_TABLE: readonly AugmentedCrewRow[] = [
  {
    maxFdpHours: 14,
    additionalCrew: 1,
    restFacility: [3],
    restFacilityLabel: 'class 3',
    citation: cars('700.60', '(1)'),
  },
  {
    maxFdpHours: 15,
    additionalCrew: 1,
    restFacility: [1, 2],
    restFacilityLabel: 'class 1 or class 2',
    citation: cars('700.60', '(1)'),
  },
  {
    maxFdpHours: 15.25,
    additionalCrew: 2,
    restFacility: [3],
    restFacilityLabel: 'class 3',
    citation: cars('700.60', '(1)'),
  },
  {
    maxFdpHours: 16.5,
    additionalCrew: 2,
    restFacility: [2],
    restFacilityLabel: 'class 2',
    citation: cars('700.60', '(1)'),
  },
  {
    maxFdpHours: 18,
    additionalCrew: 2,
    restFacility: [1],
    restFacilityLabel: 'class 1',
    citation: cars('700.60', '(1)'),
  },
] as const;

export const AUGMENTED_CREW_CITATION: Citation = cars('700.60', '(1)');

/**
 * The maximum FDP available with a given number of additional crew and rest
 * facility class. Returns the single matching row, or null if the combination is
 * not in the table.
 */
export function lookupAugmentedMaxFdp(opts: {
  additionalCrew: 1 | 2;
  restFacility: RestFacilityClass;
}): AugmentedCrewRow | null {
  const matches = AUGMENTED_CREW_TABLE.filter(
    (r) => r.additionalCrew === opts.additionalCrew && r.restFacility.includes(opts.restFacility),
  );
  if (matches.length === 0) return null;
  // If more than one row qualifies, the higher limit applies.
  return matches.reduce((a, b) => (b.maxFdpHours > a.maxFdpHours ? b : a));
}
