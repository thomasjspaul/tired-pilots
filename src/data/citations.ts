/**
 * Canonical references to the Canadian Aviation Regulations and related
 * instruments. One place to get a citation label + an authoritative URL, so
 * every `<CitationBadge>` and every data cell points at the same source.
 */

export const SOR_CARS = 'SOR/96-433';
export const SOR_FATIGUE_AMENDMENT = 'SOR/2018-269';

/** Date the CARs text referenced across the site was last retrieved / verified. */
export const CARS_RETRIEVED_ON = '2026-01-15';

/** Coming-into-force dates that recur throughout Subpart 700 Division III. */
export const EFFECTIVE_DATES = {
  /** Default fatigue-amendment CIF. */
  default: '2018-12-12',
  /** 705 (airline) operations. */
  ops705: '2020-12-12',
  /** 703 / 704 (air taxi / commuter) operations. */
  ops703704: '2022-12-12',
} as const;

/**
 * Deep link to a section of the consolidated CARs on the Justice Laws website.
 * e.g. carsSectionUrl('700.28') ->
 *   https://laws-lois.justice.gc.ca/eng/regulations/SOR-96-433/section-700.28.html
 */
export function carsSectionUrl(section: string): string {
  return `https://laws-lois.justice.gc.ca/eng/regulations/SOR-96-433/section-${section}.html`;
}

const AC_BASE =
  'https://tc.canada.ca/en/aviation/reference-centre/advisory-circulars/advisory-circular-ac-no-';

/**
 * Advisory Circular 700-047 — "Flight Crew Fatigue Management". The guidance
 * document for the PRESCRIPTIVE fatigue rules (CARs 700.19–700.72), including
 * the acclimatization mechanic behind the 700.28 tables.
 */
export const AC_700_047_URL = `${AC_BASE}700-047`;

/**
 * Advisory Circular 700-046 — "Fatigue Risk Management System Requirements".
 * Relevant to the FRMS pages only (CARs 700.200 series), not the prescriptive
 * rules or the FDP calculator.
 */
export const AC_700_046_URL = `${AC_BASE}700-046`;

/**
 * Advisory Circular 700-045 — "Exemption and Safety Case Process for Fatigue
 * Risk Management Systems". FRMS exemption process; relevant to the FRMS pages
 * only.
 */
export const AC_700_045_URL = `${AC_BASE}700-045`;

/** TP 14573 — "Fatigue Risk Management System for the Canadian Aviation Industry". */
export const TP_14573_URL =
  'https://tc.canada.ca/en/aviation/publications/fatigue-risk-management-system-canadian-aviation-industry-tp-14575';

export type Citation = {
  /** Display label, e.g. "CARs 700.28(3)". */
  label: string;
  /** Authoritative URL. */
  url: string;
  /** ISO date the text was retrieved / verified. */
  retrievedOn: string;
};

/** Build a Citation for a CARs section or subsection. `sub` is like "(3)" or "(5)". */
export function cars(section: string, sub = ''): Citation {
  return {
    label: `CARs ${section}${sub}`,
    url: carsSectionUrl(section),
    retrievedOn: CARS_RETRIEVED_ON,
  };
}
