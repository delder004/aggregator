import { describe, expect, it } from 'vitest';
import {
  bucketIndex,
  computeSessionId,
  utcDateOf,
} from './session';

describe('bucketIndex', () => {
  it('returns the same index for two timestamps in the same 30-min window', () => {
    const t = Date.UTC(2026, 3, 27, 14, 5, 0);
    const t2 = Date.UTC(2026, 3, 27, 14, 28, 59);
    expect(bucketIndex(t)).toBe(bucketIndex(t2));
  });

  it('rolls to a new index on the 30-min boundary', () => {
    const t = Date.UTC(2026, 3, 27, 14, 29, 59);
    const t2 = Date.UTC(2026, 3, 27, 14, 30, 0);
    expect(bucketIndex(t2)).toBe(bucketIndex(t) + 1);
  });
});

describe('utcDateOf', () => {
  it('formats a timestamp as YYYY-MM-DD UTC', () => {
    const t = Date.UTC(2026, 3, 27, 23, 59, 59);
    expect(utcDateOf(t)).toBe('2026-04-27');
  });

  it('handles UTC midnight as the start of the new day', () => {
    const t = Date.UTC(2026, 3, 28, 0, 0, 0);
    expect(utcDateOf(t)).toBe('2026-04-28');
  });
});

describe('computeSessionId', () => {
  const baseInputs = {
    ip: '203.0.113.5',
    userAgent: 'Mozilla/5.0',
    now: Date.UTC(2026, 3, 27, 14, 5, 0),
    utcDate: '2026-04-27',
  };
  const salt = 'a'.repeat(64);

  it('is stable for identical inputs', async () => {
    const a = await computeSessionId(baseInputs, salt);
    const b = await computeSessionId(baseInputs, salt);
    expect(a).toBe(b);
  });

  it('changes when the bucket rolls', async () => {
    const a = await computeSessionId(baseInputs, salt);
    const later = {
      ...baseInputs,
      now: baseInputs.now + 30 * 60 * 1000,
    };
    const b = await computeSessionId(later, salt);
    expect(a).not.toBe(b);
  });

  it('changes when the salt rotates', async () => {
    const a = await computeSessionId(baseInputs, salt);
    const b = await computeSessionId(baseInputs, 'b'.repeat(64));
    expect(a).not.toBe(b);
  });

  it('changes when the IP changes', async () => {
    const a = await computeSessionId(baseInputs, salt);
    const b = await computeSessionId({ ...baseInputs, ip: '198.51.100.1' }, salt);
    expect(a).not.toBe(b);
  });

  it('changes when the user agent changes', async () => {
    const a = await computeSessionId(baseInputs, salt);
    const b = await computeSessionId(
      { ...baseInputs, userAgent: 'curl/8.0' },
      salt
    );
    expect(a).not.toBe(b);
  });

  it('returns a 64-char hex string', async () => {
    const id = await computeSessionId(baseInputs, salt);
    expect(id).toMatch(/^[0-9a-f]{64}$/);
  });

  it('does not collide between two clients via UA-IP boundary tricks', async () => {
    // Without a delimiter, ip="1.2.3.4" + ua="5" would collide with
    // ip="1.2.3.45" + ua="". Pipe delimiter prevents this.
    const a = await computeSessionId(
      { ...baseInputs, ip: '1.2.3.4', userAgent: '5' },
      salt
    );
    const b = await computeSessionId(
      { ...baseInputs, ip: '1.2.3.45', userAgent: '' },
      salt
    );
    expect(a).not.toBe(b);
  });
});
