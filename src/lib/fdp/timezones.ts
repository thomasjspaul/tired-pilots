/**
 * Time-zone helpers for the FDP calculator's acclimatization input.
 *
 * The 700.28 table is read at "the local time at the location where the flight
 * crew member is acclimatized" (AC 700-047 § 4.22). So what the calculator needs
 * is the difference, in hours, between the acclimatized zone's clock and the
 * FDP-start zone's clock — which this derives from IANA zone names.
 */

/** UTC offset (minutes) for an IANA time zone at a given instant. */
export function zoneOffsetMinutes(timeZone: string, at: Date = new Date()): number {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    const p: Record<string, string> = {};
    for (const part of dtf.formatToParts(at)) p[part.type] = part.value;
    const asUTC = Date.UTC(
      +p.year,
      +p.month - 1,
      +p.day,
      +p.hour === 24 ? 0 : +p.hour,
      +p.minute,
      +p.second,
    );
    return Math.round((asUTC - at.getTime()) / 60000);
  } catch {
    return NaN;
  }
}

/**
 * Signed hours to add to the FDP-start local time to get the table start time:
 * (acclimatized-zone offset − FDP-start-zone offset). Positive = the acclimatized
 * zone is ahead. NaN if either zone is invalid.
 */
export function offsetHoursBetween(
  acclimatizedZone: string,
  fdpStartZone: string,
  at: Date = new Date(),
): number {
  const a = zoneOffsetMinutes(acclimatizedZone, at);
  const b = zoneOffsetMinutes(fdpStartZone, at);
  if (Number.isNaN(a) || Number.isNaN(b)) return NaN;
  return (a - b) / 60;
}

export function describeOffset(hours: number): string {
  if (!Number.isFinite(hours)) return '';
  if (hours === 0) return 'same time as where you report';
  const abs = Math.abs(hours);
  const n = Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
  return `${n} h ${hours > 0 ? 'ahead of' : 'behind'} where you report`;
}

/** The browser's own time zone, or a sensible default. */
export function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto';
  } catch {
    return 'America/Toronto';
  }
}

export interface ZoneOption {
  /** IANA name — the value. */
  id: string;
  /** Search/display label. */
  label: string;
}

/**
 * Curated shortlist first (Canadian zones by their CARs names, then common
 * destinations), then every IANA zone the browser knows. Used to populate a
 * <datalist> so the user can type a city, a country, or "Eastern".
 */
export function zoneOptions(): ZoneOption[] {
  const curated: ZoneOption[] = [
    { id: 'America/Vancouver', label: 'Pacific — Vancouver, Canada' },
    { id: 'America/Edmonton', label: 'Mountain — Calgary / Edmonton, Canada' },
    { id: 'America/Regina', label: 'Central (no DST) — Regina / Saskatchewan, Canada' },
    { id: 'America/Winnipeg', label: 'Central — Winnipeg, Canada' },
    { id: 'America/Toronto', label: 'Eastern — Toronto / Ottawa, Canada' },
    { id: 'America/Halifax', label: 'Atlantic — Halifax, Canada' },
    { id: 'America/St_Johns', label: 'Newfoundland — St. John’s, Canada' },
    { id: 'America/Iqaluit', label: 'Eastern — Iqaluit, Nunavut, Canada' },
    { id: 'America/Whitehorse', label: 'Yukon — Whitehorse, Canada' },
    { id: 'America/New_York', label: 'Eastern — New York, USA' },
    { id: 'America/Chicago', label: 'Central — Chicago, USA' },
    { id: 'America/Denver', label: 'Mountain — Denver, USA' },
    { id: 'America/Phoenix', label: 'Mountain (no DST) — Phoenix, USA' },
    { id: 'America/Los_Angeles', label: 'Pacific — Los Angeles, USA' },
    { id: 'America/Anchorage', label: 'Alaska — Anchorage, USA' },
    { id: 'Pacific/Honolulu', label: 'Hawaii — Honolulu, USA' },
    { id: 'America/Mexico_City', label: 'Mexico City, Mexico' },
    { id: 'Europe/London', label: 'London, United Kingdom' },
    { id: 'Europe/Dublin', label: 'Dublin, Ireland' },
    { id: 'Europe/Paris', label: 'Paris, France' },
    { id: 'Europe/Frankfurt', label: 'Frankfurt, Germany' },
    { id: 'Europe/Amsterdam', label: 'Amsterdam, Netherlands' },
    { id: 'Europe/Madrid', label: 'Madrid, Spain' },
    { id: 'Europe/Rome', label: 'Rome, Italy' },
    { id: 'Europe/Zurich', label: 'Zürich, Switzerland' },
    { id: 'Europe/Reykjavik', label: 'Reykjavík, Iceland' },
    { id: 'Atlantic/Azores', label: 'Azores, Portugal' },
    { id: 'Asia/Dubai', label: 'Dubai, United Arab Emirates' },
    { id: 'Asia/Doha', label: 'Doha, Qatar' },
    { id: 'Asia/Hong_Kong', label: 'Hong Kong' },
    { id: 'Asia/Tokyo', label: 'Tokyo, Japan' },
    { id: 'Asia/Singapore', label: 'Singapore' },
    { id: 'Asia/Shanghai', label: 'Shanghai, China' },
    { id: 'Australia/Sydney', label: 'Sydney, Australia' },
    { id: 'Pacific/Auckland', label: 'Auckland, New Zealand' },
    { id: 'America/Sao_Paulo', label: 'São Paulo, Brazil' },
    { id: 'America/Bogota', label: 'Bogotá, Colombia' },
    { id: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  ];
  const seen = new Set(curated.map((c) => c.id));
  let all: string[] = [];
  try {
    all =
      (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.(
        'timeZone',
      ) ?? [];
  } catch {
    all = [];
  }
  const rest: ZoneOption[] = all
    .filter((z) => !seen.has(z))
    .map((z) => ({ id: z, label: `${z.split('/').pop()?.replace(/_/g, ' ')} — ${z}` }));
  return [...curated, ...rest];
}
