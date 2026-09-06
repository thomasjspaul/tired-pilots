/**
 * The "Flowchart for Increased Rest Periods" from AC 700-047, Appendix A —
 * reproduced from the text description in the AC (verified 2026-01-15). It routes
 * you to the provision that sets the rest period after a flight duty period was
 * extended.
 */

export interface QuestionNode {
  id: string;
  kind: 'question';
  text: string;
  yes: string;
  no: string;
}
export interface ChoiceNode {
  id: string;
  kind: 'choice';
  text: string;
  options: { label: string; next: string }[];
}
export interface OutcomeNode {
  id: string;
  kind: 'outcome';
  /** e.g. "CARs 700.40(1)" — or null when no increased-rest provision applies. */
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
    yes: 'q2',
    no: 'o_40_1',
  },
  q2: {
    id: 'q2',
    kind: 'question',
    text: 'Does the extension involve duty after the end of the flight duty period, but not positioning?',
    yes: 'o_40_2',
    no: 'q3',
  },
  q3: {
    id: 'q3',
    kind: 'question',
    text: 'Does the extension involve positioning after the end of the flight duty period?',
    yes: 'o_43',
    no: 'q4',
  },
  q4: {
    id: 'q4',
    kind: 'question',
    text: 'Are the flight crew augmented?',
    yes: 'c4',
    no: 'q5',
  },
  c4: {
    id: 'c4',
    kind: 'choice',
    text: 'Augmented crew — which situation?',
    options: [
      { label: 'Normal rest after an augmented FDP', next: 'o_60_7' },
      { label: 'The FDP was extended for an unforeseen operational circumstance', next: 'o_63_3' },
    ],
  },
  q5: {
    id: 'q5',
    kind: 'question',
    text: 'Was the flight duty period extended for an unforeseen operational circumstance?',
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
