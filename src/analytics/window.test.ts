import { describe, it, expect } from 'vitest';
import { getWeeklyWindow, getPreviousWeeklyWindow } from './window';

describe('getWeeklyWindow', () => {
  it('returns Monday 00:00 UTC boundaries', () => {
    // Wed 2026-04-15 14:33 UTC → Mon 2026-04-13 00:00 UTC
    const result = getWeeklyWindow(new Date('2026-04-15T14:33:00.000Z'));
    expect(result.windowStart).toBe('2026-04-13T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-20T00:00:00.000Z');
  });

  it('snaps a Monday-at-midnight to itself', () => {
    const result = getWeeklyWindow(new Date('2026-04-13T00:00:00.000Z'));
    expect(result.windowStart).toBe('2026-04-13T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-20T00:00:00.000Z');
  });

  it('snaps a Sunday-23:59 to the previous Monday', () => {
    const result = getWeeklyWindow(new Date('2026-04-19T23:59:59.999Z'));
    expect(result.windowStart).toBe('2026-04-13T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-20T00:00:00.000Z');
  });

  it('is idempotent — same window for any moment within it', () => {
    const a = getWeeklyWindow(new Date('2026-04-13T00:00:01.000Z'));
    const b = getWeeklyWindow(new Date('2026-04-15T08:42:00.000Z'));
    const c = getWeeklyWindow(new Date('2026-04-19T23:59:59.000Z'));
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('handles year boundary correctly', () => {
    // 2026-01-01 is a Thursday → window should start Mon 2025-12-29
    const result = getWeeklyWindow(new Date('2026-01-01T12:00:00.000Z'));
    expect(result.windowStart).toBe('2025-12-29T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-01-05T00:00:00.000Z');
  });
});

describe('getPreviousWeeklyWindow', () => {
  it('returns the window immediately before the current one', () => {
    const result = getPreviousWeeklyWindow(new Date('2026-04-15T14:00:00.000Z'));
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });
});
