/**
 * Canonical weekly window. Every snapshot writer in the consolidation loop
 * must derive its window from here so UNIQUE(window_start, window_end, ...)
 * constraints actually prevent duplicates.
 *
 * A weekly window is [Monday 00:00:00 UTC, next Monday 00:00:00 UTC).
 * The window for a given moment is the most recent Monday at or before it.
 */

export interface WeeklyWindow {
  windowStart: string;
  windowEnd: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getWeeklyWindow(at: Date = new Date()): WeeklyWindow {
  const utc = new Date(Date.UTC(
    at.getUTCFullYear(),
    at.getUTCMonth(),
    at.getUTCDate(),
    0, 0, 0, 0
  ));
  // getUTCDay: Sun = 0, Mon = 1, ..., Sat = 6. Map so Mon = 0, Sun = 6.
  const mondayOffset = (utc.getUTCDay() + 6) % 7;
  const start = new Date(utc.getTime() - mondayOffset * MS_PER_DAY);
  const end = new Date(start.getTime() + 7 * MS_PER_DAY);
  return {
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

export function getPreviousWeeklyWindow(at: Date = new Date()): WeeklyWindow {
  const current = getWeeklyWindow(at);
  const start = new Date(new Date(current.windowStart).getTime() - 7 * MS_PER_DAY);
  return {
    windowStart: start.toISOString(),
    windowEnd: current.windowStart,
  };
}

/**
 * Strict ISO 8601 timestamp regex. Requires:
 *   - full date: YYYY-MM-DD
 *   - T separator
 *   - full time: HH:MM:SS
 *   - optional fractional seconds (up to 3 digits)
 *   - required timezone designator: Z or ±HH:MM
 *
 * Rejects timezone-less forms like `2026-04-06T00:00:00`, which Date.parse
 * silently interprets in the runtime's local timezone. In a non-UTC
 * runtime, such inputs canonicalize to off-boundary windows and break
 * UNIQUE constraints on snapshot tables. Every snapshot writer that
 * accepts manual window overrides should validate via
 * parseStrictIsoTimestamp before storing the window as a DB key.
 */
export const STRICT_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parse a strict ISO 8601 timestamp and return its epoch ms, or null if
 * the input is not in the strict form or represents an impossible date.
 *
 * Two-step validation:
 *   1. Regex shape: enforces explicit timezone and standard structure.
 *   2. Calendar validity: the YYYY-MM-DD portion is round-tripped through
 *      Date at UTC midnight, which catches impossible days (2026-02-31,
 *      2026-13-01, non-leap Feb 29) that Date.parse would silently
 *      normalize into the next month.
 *
 * Impossible time components (25:00:00 etc.) are rejected by Date.parse
 * returning NaN on the full string.
 */
export function parseStrictIsoTimestamp(s: string): number | null {
  const match = STRICT_ISO_RE.exec(s);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const dateOnlyMs = Date.parse(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  if (Number.isNaN(dateOnlyMs)) return null;
  if (new Date(dateOnlyMs).toISOString().slice(0, 10) !== `${yyyy}-${mm}-${dd}`) {
    return null;
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  return ms;
}
