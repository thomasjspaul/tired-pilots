/**
 * The "Flowchart for Increased Rest Periods" from AC 700-047, Appendix A —
 * reproduced from the text description in the AC (verified 2026-01-15). It routes
 * you to the provision that sets the rest period after a flight duty period was
 * extended.
 *
 * The `question` text stays faithful to the AC; `hint` restates it in plain
 * terms with a concrete example, and `help` links the relevant page.
 */

export interface QuestionNode {
  id: string;
  kind: 'question';
  text: string;
  hint?: string;
  help?: { label: string; href: string };
  yes: string;
  no: string;
}
export interface ChoiceNode {
  id: string;
  kind: 'choice';
  text: string;
  hint?: string;
  help?: { label: string; href: string };
  options: { label: string; next: string }[];
}
export interface OutcomeNode {
  id: string;
  kind: 'outcome';
  /** e.g. "CARs 700.40(1)". */
  citation: string;
  href: string;
  text: string;
}
export type FlowNode = QuestionNode | ChoiceNode | OutcomeNode;

export const INCREASED_REST_START = 'q1';

export const INCREASED_REST_NODES: Record<string, FlowNode> = {
  q1: {
    id: 'q1',
    kind: 'question',
    text: 'Were the hours of work extended beyond the maximum flight duty period in section 700.28?',
    hint: 'Plain terms: did the duty actually run longer than the maximum FDP the 700.28 tables allowed for that trip? If it finished within the limit, none of the increased-rest rules apply.',
    help: { label: 'Maximum FDP (700.28)', href: '/rules/700-28' },
    yes: 'q2',
    no: 'o_40_1',
  },
  q2: {
    id: 'q2',
    kind: 'question',
    text: 'Does the extension involve duty after the end of the flight duty period, but not positioning?',
    hint: 'Plain terms: after the last flight ended, were you kept on for other work — paperwork, cleaning the aircraft, ground duties — and that is what pushed you past the limit? (Positioning is the next question.)',
    yes: 'o_40_2',
    no: 'q3',
  },
  q3: {
    id: 'q3',
    kind: 'question',
    text: 'Does the extension involve positioning after the end of the flight duty period?',
    hint: 'Plain terms: after the last flight, were you sent to travel / reposition (dead-head) to another place, and that travel pushed you past the limit?',
    help: { label: 'Positioning rest (700.43)', href: '/rules/700-43' },
    yes: 'o_43',
    no: 'q4',
  },
  q4: {
    id: 'q4',
    kind: 'question',
    text: 'Are the flight crew augmented?',
    hint: 'Plain terms: was there an extra pilot (or two) plus an on-board rest facility, so the maximum FDP came from the 700.60 table rather than 700.28?',
    help: { label: 'Augmented crew (700.60)', href: '/rules/700-60' },
    yes: 'c4',
    no: 'q5',
  },
  c4: {
    id: 'c4',
    kind: 'choice',
    text: 'Augmented crew — which situation?',
    hint: 'Pick the one that matches how the FDP was extended.',
    options: [
      { label: 'A normal augmented flight duty period', next: 'o_60_7' },
      {
        label: 'The pilot-in-command extended it for an unforeseen operational circumstance',
        next: 'o_63_3',
      },
    ],
  },
  q5: {
    id: 'q5',
    kind: 'question',
    text: 'Was the flight duty period extended for an unforeseen operational circumstance?',
    hint: 'Plain terms: did the pilot-in-command extend the FDP because of something unforecast and beyond the operator’s control — weather, an equipment problem, an ATC delay?',
    help: { label: 'Unforeseen circumstances (700.63)', href: '/rules/700-63' },
    yes: 'o_63_3',
    no: 'o_none',
  },

  o_40_1: {
    id: 'o_40_1',
    kind: 'outcome',
    citation: 'CARs 700.40(1)',
    href: '/rules/700-40',
    text: 'The normal rest period applies: 12 h at home base (or 11 h + travel time, or 10 h in suitable accommodation), or 10 h in suitable accommodation away from home base.',
  },
  o_40_2: {
    id: 'o_40_2',
    kind: 'outcome',
    citation: 'CARs 700.40(2)',
    href: '/rules/700-40',
    text: 'The rest period is the longer of (the maximum FDP + the time worked beyond it) and the normal 700.40(1) rest period.',
  },
  o_43: {
    id: 'o_43',
    kind: 'outcome',
    citation: 'CARs 700.43',
    href: '/rules/700-43',
    text: 'The rest period equals your total hours of work — plus the amount over the maximum FDP if that is more than 3 hours — and never less than the 700.40(1) rest.',
  },
  o_60_7: {
    id: 'o_60_7',
    kind: 'outcome',
    citation: 'CARs 700.60(7)',
    href: '/rules/700-60',
    text: 'The rest period is the longest of: the duration of the duty just completed, 16 h if the FDP ends at home base, or 14 h in suitable accommodation.',
  },
  o_63_3: {
    id: 'o_63_3',
    kind: 'outcome',
    citation: 'CARs 700.63(3)',
    href: '/rules/700-63',
    text: 'The rest period is increased by an amount at least equal to the extension of the flight duty period.',
  },
  o_none: {
    id: 'o_none',
    kind: 'outcome',
    citation: 'CARs 700.40(1)',
    href: '/rules/700-40',
    text: 'None of the increased-rest provisions apply — the normal 700.40(1) rest period applies.',
  },
};
