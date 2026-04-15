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
