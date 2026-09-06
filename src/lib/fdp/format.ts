/** "12.5" -> "12:30", "9" -> "9:00". Handles values >= 24 without wrapping. */
export function hoursToHHMM(hours: number): string {
  const total = Math.round(hours * 60);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** "07:30" / "7:30" -> minutes from midnight. Throws on anything unparseable. */
export function parseClock(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Not a HH:MM time: "${hhmm}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) throw new Error(`Time out of range: "${hhmm}"`);
  return h * 60 + min;
}

/** minutes from midnight -> "07:30" (24h clock, wraps). */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
