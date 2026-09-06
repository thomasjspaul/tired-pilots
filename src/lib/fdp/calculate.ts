import { DURATION_BUCKET_LABEL, lookupMaxFdp, type AvgDurationBucket } from '../../data/fdp';
import { lookupAugmentedMaxFdp } from '../../data/augmentedCrew';
import { applySplitDuty } from '../../data/splitDuty';
import { effectiveStartMinutes } from './acclimatization';
import { hoursToHHMM, minutesToClock, parseClock } from './format';
import type { FdpInput, FdpResult, FdpStep } from './types';

/** Absolute ceiling on a flight duty period — CARs 700.62(1). */
const ABSOLUTE_MAX_HOURS = 18;

const bucketLabel = (b: AvgDurationBucket) => DURATION_BUCKET_LABEL[b];

/**
 * Maximum flight duty period for a 703/704/705 operation.
 *
 * Pipeline: acclimatization (700.19(2)/700.28(5)) -> base table lookup
 * (700.28(2)/(3)/(4) or (9)) -> augmented crew replaces the base (700.60) ->
 * split-duty break extends it (700.50) -> absolute 18-hour clamp (700.62(1)).
 *
 * Positioning, delayed reporting (700.52), disruptive-schedule and time-zone
 * REST rules, and UOC extensions (700.63) are out of scope for this function —
 * they don't change the scheduled maximum FDP.
 */
export function calculateMaxFdp(input: FdpInput): FdpResult {
  const steps: FdpStep[] = [];
  const warnings: string[] = [];
  const citations: string[] = [];
  const cite = (c: string) => {
    if (!citations.includes(c)) citations.push(c);
    return c;
  };

  // --- 1. acclimatization -----------------------------------------------------
  const reportMin = parseClock(input.startTime);
  const eff = effectiveStartMinutes(reportMin, input.acclimatization);
  if (input.acclimatization.state === 'not-acclimatized') {
    steps.push({
      label: 'Table start time',
      value: minutesToClock(eff.minutes),
      detail: eff.note,
      citation: cite('CARs 700.28(5); AC 700-047 § 4.22'),
    });
    warnings.push(
      'Not-acclimatized handling follows AC 700-047 § 4.22. Confirm the time-zone offset and direction against your Operations Manual.',
    );
  }

  // --- 2. base table lookup -------------------------------------------------------
  if (input.numFlights < 1) {
    warnings.push('At least one flight is needed to read the table; using 1.');
  }
  const numFlights = Math.max(1, Math.floor(input.numFlights));
  const base = lookupMaxFdp({
    startMinutes: eff.minutes,
    numFlights,
    avgDuration: input.avgDuration,
    dayVfr: input.dayVfr,
  });

  let maxHours = base.hours;
  steps.push({
    label: input.dayVfr ? 'Base maximum FDP (day VFR)' : 'Base maximum FDP',
    value: hoursToHHMM(base.hours),
    detail: input.dayVfr
      ? `700.28(9) day-VFR table, start-time row ${base.startBand.label}.`
      : `Average flight duration ${bucketLabel(input.avgDuration)}: ${base.citation.label}, ` +
        `start-time row ${base.startBand.label}, ${base.flightBand?.label} column.`,
    citation: cite(base.citation.label),
  });

  // --- 3. augmented crew replaces the base ----------------------------------------
  if (input.augmented) {
    const aug = lookupAugmentedMaxFdp(input.augmented);
    if (!aug) {
      warnings.push(
        `No 700.60 row matches ${input.augmented.additionalCrew} additional crew with a class ${input.augmented.restFacility} rest facility — augmented adjustment not applied.`,
      );
    } else {
      maxHours = aug.maxFdpHours;
      steps.push({
        label: 'Augmented crew',
        value: hoursToHHMM(aug.maxFdpHours),
        detail: `${aug.additionalCrew} additional flight crew member${aug.additionalCrew > 1 ? 's' : ''} + ${aug.restFacilityLabel} — the 700.60 table replaces the base maximum.`,
        citation: cite('CARs 700.60(1)'),
      });
      if (numFlights > 3) {
        warnings.push(
          'The 700.60 augmented maximum applies only to a flight duty period with three flights or fewer (700.60(2)).',
        );
      }
      warnings.push(
        'After an augmented FDP the rest period is the longest of the duty just completed, 16 h (ends at home base) or 14 h in suitable accommodation (700.60(7)).',
      );
    }
  }

  // --- 4. split flight duty extends the maximum ---------------------------------
  if (input.split) {
    const split = applySplitDuty(input.split.breakMinutes, input.split.window);
    if (split.belowMinimum) {
      warnings.push(
        `A split-duty break must be at least 60 minutes (700.50(1)); ${input.split.breakMinutes} min entered.`,
      );
    }
    const extHours = split.extensionMinutes / 60;
    maxHours += extHours;
    steps.push({
      label: 'Split flight duty',
      value: `+${hoursToHHMM(extHours)}`,
      detail:
        `(${input.split.breakMinutes} min − 45 min) × ` +
        `${input.split.window === 'overnight' ? '100%' : '50%'} = ${split.extensionMinutes} min extra FDP.`,
      citation: cite(split.citation.label),
    });
    warnings.push(
      'On night duty, split flight duty may extend the FDP for at most three consecutive nights (700.50(3)).',
    );
  }

  // --- 5. absolute ceiling -----------------------------------------------------
  if (maxHours > ABSOLUTE_MAX_HOURS) {
    steps.push({
      label: 'Capped at 18:00',
      value: hoursToHHMM(ABSOLUTE_MAX_HOURS),
      detail: `The result (${hoursToHHMM(maxHours)}) exceeds the absolute 18-hour flight-duty-period ceiling.`,
      citation: cite('CARs 700.62(1)'),
    });
    warnings.push(
      'The regulations do not fully resolve how the 18-hour ceiling and an un-capped split-duty extension interact — treat 18 hours as the limit and confirm with your Operations Manual.',
    );
    maxHours = ABSOLUTE_MAX_HOURS;
  }

  // round to the nearest minute
  maxHours = Math.round(maxHours * 60) / 60;

  return {
    maxFdpHours: maxHours,
    maxFdpFormatted: hoursToHHMM(maxHours),
    steps,
    citations,
    warnings,
  };
}
