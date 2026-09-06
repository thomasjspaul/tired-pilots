/**
 * CARs 700.50 — Split flight duty. Single source of truth for the extension a
 * qualifying break buys. Verified against laws-lois (SOR/96-433) and
 * AC 700-047 §§ 4.49–4.53.
 */

import { cars, type Citation } from './citations';

/** Minimum break length, 700.50(1). */
export const MIN_BREAK_MINUTES = 60;

/** Fixed deduction applied before the calculation, 700.50(2). */
export const BREAK_DEDUCTION_MINUTES = 45;

export type SplitWindow = 'overnight' | 'day' | 'uoc-replan';

export const SPLIT_RATE: Record<SplitWindow, number> = {
  /** 00:00–05:59 acclimatized — 700.50(1)(a). */
  overnight: 1.0,
  /** 06:00–23:59 acclimatized — 700.50(1)(b). */
  day: 0.5,
  /** Re-planned in flight for a UOC — 700.50(1)(c). */
  'uoc-replan': 0.5,
};

export const SPLIT_CITATION: Record<SplitWindow, Citation> = {
  overnight: cars('700.50', '(1)(a)'),
  day: cars('700.50', '(1)(b)'),
  'uoc-replan': cars('700.50', '(1)(c)'),
};

export interface SplitResult {
  /** Extra flight duty period allowed, in minutes (>= 0). */
  extensionMinutes: number;
  /** The break length after the 45-minute deduction. */
  effectiveBreakMinutes: number;
  citation: Citation;
  /** Present when the break is shorter than the 60-minute minimum. */
  belowMinimum: boolean;
}

/**
 * The extension a break buys under 700.50(1)–(2):
 * (break − 45 minutes) × rate, never negative.
 *
 * 700.50(2) says the 45-minute deduction applies "for the purposes of
 * subsection (1)" — i.e. to (a), (b) and (c). AC 700-047 § 4.49(1)(c) describes
 * the UOC case as "50% of the duration of the break provided" without repeating
 * the deduction; this module follows the regulation text and still deducts 45.
 */
export function applySplitDuty(breakMinutes: number, window: SplitWindow): SplitResult {
  const effective = Math.max(0, breakMinutes - BREAK_DEDUCTION_MINUTES);
  return {
    extensionMinutes: Math.round(effective * SPLIT_RATE[window] * 100) / 100,
    effectiveBreakMinutes: effective,
    citation: SPLIT_CITATION[window],
    belowMinimum: breakMinutes < MIN_BREAK_MINUTES,
  };
}
