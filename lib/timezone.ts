/**
 * Timezone utilities built on top of the runtime's IANA-aware Intl APIs.
 * No external dependency — Node 18+/Next.js ship with full ICU data.
 */

/**
 * Return true if `tz` is a valid IANA zone (e.g. "America/Los_Angeles").
 * Rejects empty strings and fixed UTC offsets like "+05:30".
 */
export function isValidTimezone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== 'string') return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Interpret `YYYY-MM-DD` + `HH:MM` as a wall-clock time in `timezone` and
 * return the corresponding UTC Date.
 *
 * Example: zonedDateTimeToUtc("2026-04-29", 9, 0, "America/Los_Angeles")
 *   → Date representing 2026-04-29T16:00:00.000Z (PDT = UTC-7).
 *
 * Algorithm: guess the instant by treating the wall-clock string as if it
 * were UTC, ask Intl what that instant looks like in `timezone`, and the
 * delta between the two is the zone's offset at that moment (DST-aware).
 * Subtract the offset to get the true UTC instant.
 */
export function zonedDateTimeToUtc(
  date: string,
  hour: number,
  minute: number,
  timezone: string
): Date {
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const guessUtc = new Date(`${date}T${hh}:${mm}:00Z`);

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(guessUtc);

  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }

  // Intl formats midnight as "24" in some locales — normalize to "00".
  const zonedHour = map.hour === '24' ? 0 : Number(map.hour);

  const zonedAsUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    zonedHour,
    Number(map.minute),
    Number(map.second)
  );

  const tzOffsetMs = zonedAsUtcMs - guessUtc.getTime();
  return new Date(guessUtc.getTime() - tzOffsetMs);
}
