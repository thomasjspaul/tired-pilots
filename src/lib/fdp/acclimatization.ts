import type { Acclimatization } from './types';
import { minutesToClock } from './format';

export interface EffectiveStart {
  minutes: number;
  /** Human description of how it was derived. */
  note: string;
}

/**
 * The clock time used to read the 700.28 tables.
 *
 * - Acclimatized to where the FDP begins: the local report time (700.19(2)(a)).
 * - Not acclimatized: the local time in the zone you are still acclimatized to
 *   (700.19(2)(b), 700.28(5); AC 700-047 § 4.22) — report time shifted by the
 *   offset between the two zones.
 */
export function effectiveStartMinutes(reportMinutes: number, acc: Acclimatization): EffectiveStart {
  if (acc.state === 'acclimatized') {
    return {
      minutes: reportMinutes,
      note: 'Acclimatized — the table start time is your local report time.',
    };
  }
  const shift = acc.acclimatizedZoneOffsetHours * 60;
  const shifted = ((Math.round(reportMinutes + shift) % 1440) + 1440) % 1440;
  const dir =
    acc.acclimatizedZoneOffsetHours === 0
      ? 'the same time as'
      : `${Math.abs(acc.acclimatizedZoneOffsetHours)} h ${acc.acclimatizedZoneOffsetHours > 0 ? 'ahead of' : 'behind'}`;
  return {
    minutes: shifted,
    note: `Not acclimatized — the zone you are acclimatized to is ${dir} where you report, so the table start time is ${minutesToClock(
      shifted,
    )}.`,
  };
}
