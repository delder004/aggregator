import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveSearchConsoleWindow,
  runSearchConsoleSnapshot,
  toGscDateRange,
} from './search-console';
import type { Env } from '../types';

describe('resolveSearchConsoleWindow', () => {
  it('canonicalizes equivalent-instant strings', () => {
    const a = resolveSearchConsoleWindow({
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    const b = resolveSearchConsoleWindow({
      windowStart: '2026-04-05T14:00:00-10:00',
      windowEnd: '2026-04-12T14:00:00-10:00',
    });
    expect(a).toEqual(b);
    expect(a.windowStart).toBe('2026-04-06T00:00:00.000Z');
  });

  it('rejects timezone-less ISO strings', () => {
    expect(() =>
      resolveSearchConsoleWindow({
        windowStart: '2026-04-06T00:00:00',
        windowEnd: '2026-04-13T00:00:00',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      resolveSearchConsoleWindow({
        windowStart: '2026-02-31T00:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('rejects empty windows (start >= end)', () => {
    expect(() =>
      resolveSearchConsoleWindow({
        windowStart: '2026-04-13T00:00:00Z',
        windowEnd: '2026-04-06T00:00:00Z',
      })
    ).toThrow(/empty/);
  });

  it('rejects half-specified windows', () => {
    expect(() =>
      resolveSearchConsoleWindow({ windowStart: '2026-04-06T00:00:00Z' })
    ).toThrow(/both be provided or both omitted/);
  });
});

describe('toGscDateRange', () => {
  it('maps a canonical UTC week to a non-overlapping 7-PT-day range', () => {
    // UTC [Mon 00:00Z, next Mon 00:00Z) → PT [Mon, Sun] inclusive
    const result = toGscDateRange(
      '2026-04-06T00:00:00.000Z',
      '2026-04-13T00:00:00.000Z'
    );
    expect(result.startDate).toBe('2026-04-06');
    expect(result.endDate).toBe('2026-04-12');
  });

  it('tiles exactly: adjacent weeks do NOT overlap', () => {
    const weekA = toGscDateRange(
      '2026-04-06T00:00:00.000Z',
      '2026-04-13T00:00:00.000Z'
    );
    const weekB = toGscDateRange(
      '2026-04-13T00:00:00.000Z',
      '2026-04-20T00:00:00.000Z'
    );
    // weekA ends on Apr 12; weekB starts on Apr 13 — exactly one PT day later
    expect(weekA.endDate).toBe('2026-04-12');
    expect(weekB.startDate).toBe('2026-04-13');
    // No shared dates
    expect(weekA.endDate < weekB.startDate).toBe(true);
  });

  it('handles month boundaries in the end-date arithmetic', () => {
    const result = toGscDateRange(
      '2026-03-30T00:00:00.000Z',
      '2026-04-06T00:00:00.000Z'
    );
    expect(result.startDate).toBe('2026-03-30');
    expect(result.endDate).toBe('2026-04-05');
  });

  it('handles year boundaries in the end-date arithmetic', () => {
    const result = toGscDateRange(
      '2025-12-29T00:00:00.000Z',
      '2026-01-05T00:00:00.000Z'
    );
    expect(result.startDate).toBe('2025-12-29');
    expect(result.endDate).toBe('2026-01-04');
  });

  it('handles leap-year Feb 29 in the end-date arithmetic', () => {
    // 2028-02-23 + 6 days should land on 2028-02-29 (leap year)
    const result = toGscDateRange(
      '2028-02-23T00:00:00.000Z',
      '2028-03-01T00:00:00.000Z'
    );
    expect(result.startDate).toBe('2028-02-23');
    expect(result.endDate).toBe('2028-02-29');
  });

  it('handles a non-weekly custom window with the same rule', () => {
    // 3-day window: startDate + 2 days
    const result = toGscDateRange(
      '2026-04-06T00:00:00.000Z',
      '2026-04-09T00:00:00.000Z'
    );
    expect(result.startDate).toBe('2026-04-06');
    expect(result.endDate).toBe('2026-04-08');
  });

  it('throws on invalid windowStart', () => {
    expect(() =>
      toGscDateRange('not-a-date', '2026-04-13T00:00:00.000Z')
    ).toThrow(/Invalid windowStart/);
  });

  it('throws on invalid windowEnd', () => {
    expect(() =>
      toGscDateRange('2026-04-06T00:00:00.000Z', 'not-a-date')
    ).toThrow(/Invalid windowEnd/);
  });

  it('throws on empty or inverted windows', () => {
    expect(() =>
      toGscDateRange(
        '2026-04-13T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z'
      )
    ).toThrow(/empty or inverted/);
    expect(() =>
      toGscDateRange(
        '2026-04-06T00:00:00.000Z',
        '2026-04-06T00:00:00.000Z'
      )
    ).toThrow(/empty or inverted/);
  });

  it('rejects non-midnight windowStart (partial-day coercion hazard)', () => {
    // 12:00Z start would silently become a 2.5-day window that coerces
    // into the wrong PT date range. Reject loudly instead.
    expect(() =>
      toGscDateRange(
        '2026-04-06T12:00:00.000Z',
        '2026-04-09T00:00:00.000Z'
      )
    ).toThrow(/UTC midnight/);
  });

  it('rejects non-midnight windowEnd', () => {
    expect(() =>
      toGscDateRange(
        '2026-04-06T00:00:00.000Z',
        '2026-04-09T12:00:00.000Z'
      )
    ).toThrow(/UTC midnight/);
  });

  it('rejects sub-second offsets from midnight', () => {
    expect(() =>
      toGscDateRange(
        '2026-04-06T00:00:00.001Z',
        '2026-04-13T00:00:00.000Z'
      )
    ).toThrow(/UTC midnight/);
  });

  it('accepts an equivalent midnight expressed via non-UTC offset and canonicalizes to UTC date', () => {
    // 2026-04-05T17:00:00-07:00 is the same instant as 2026-04-06T00:00:00Z.
    // The function should take the UTC date of the instant (Apr 6), not a
    // raw slice of the local-offset input string (Apr 5).
    const result = toGscDateRange(
      '2026-04-05T17:00:00-07:00',
      '2026-04-12T17:00:00-07:00'
    );
    expect(result.startDate).toBe('2026-04-06');
    expect(result.endDate).toBe('2026-04-12');
  });
});

describe('runSearchConsoleSnapshot', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeDb(claimResult: unknown, completeChanges = 1) {
    const first = vi.fn().mockResolvedValue(claimResult);
    const run = vi
      .fn()
      .mockResolvedValue({ meta: { changes: completeChanges } });
    const bind = vi.fn().mockReturnThis();
    const prepare = vi.fn().mockReturnValue({ first, bind, run });
    return { db: { prepare } as unknown as D1Database, first, run, prepare };
  }

  function makeKv() {
    const put = vi.fn(async () => undefined);
    return { kv: { put } as unknown as KVNamespace, put };
  }

  function mockGscFetches(
    tokenBody: string,
    totalsRow: unknown | null,
    queriesRows: unknown[],
    pagesRows: unknown[]
  ) {
    const fetchMock = vi.fn<typeof fetch>(async (url, init) => {
      const urlString = typeof url === 'string' ? url : url.toString();
      if (urlString.includes('oauth2.googleapis.com')) {
        return new Response(tokenBody, { status: 200 });
      }
      if (urlString.includes('searchAnalytics/query')) {
        // Dispatch by the dimensions field in the request body rather than
        // call order — Promise.all means arrival order is not deterministic.
        const body = JSON.parse((init?.body as string) ?? '{}');
        const dims = Array.isArray(body.dimensions) ? body.dimensions : [];
        let rows: unknown[];
        if (dims.length === 0) {
          rows = totalsRow ? [totalsRow] : [];
        } else if (dims[0] === 'query') {
          rows = queriesRows;
        } else if (dims[0] === 'page') {
          rows = pagesRows;
        } else {
          rows = [];
        }
        return new Response(JSON.stringify({ rows }), { status: 200 });
      }
      return new Response('not mocked', { status: 500 });
    });
    globalThis.fetch = fetchMock;
    return fetchMock;
  }

  it('throws if any GSC secret is missing', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    await expect(runSearchConsoleSnapshot(env)).rejects.toThrow(
      /GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN/
    );
  });

  it('throws if siteUrl is not provided via env or options', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
    } as unknown as Env;
    await expect(runSearchConsoleSnapshot(env)).rejects.toThrow(/siteUrl/);
  });

  it('returns no-op when claim returns null', async () => {
    const { db } = makeDb(null);
    const { kv } = makeKv();
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    const result = await runSearchConsoleSnapshot(env, {
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/already complete/);
  });

  it('exchanges refresh token, fetches totals + both dimensions, writes blob, completes', async () => {
    const { db, prepare } = makeDb({ id: 'snap-1', attempt_count: 1 }, 1);
    const { kv, put } = makeKv();
    const fetchMock = mockGscFetches(
      JSON.stringify({ access_token: 'at-xyz' }),
      // Totals row (authoritative, from dimensions:[])
      {
        clicks: 250,
        impressions: 8000,
        ctr: 0.03125,
        position: 18.4,
      },
      // Top queries (top-N, incomplete)
      [
        {
          keys: ['agentic ai accounting'],
          clicks: 5,
          impressions: 100,
          ctr: 0.05,
          position: 8.2,
        },
      ],
      // Top pages (top-N, incomplete)
      [
        {
          keys: ['https://example.com/article/abc'],
          clicks: 3,
          impressions: 60,
          ctr: 0.05,
          position: 7,
        },
      ]
    );
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;

    const result = await runSearchConsoleSnapshot(env, {
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    expect(result.written).toBe(true);
    expect(result.blobKey).toBe(
      'search-console/2026-04-06T00:00:00.000Z/snap-1.json'
    );
    // Authoritative totals come from the dimensions:[] call, NOT from
    // summing topQueries.
    expect(result.data?.totals).toEqual({
      impressions: 8000,
      clicks: 250,
      ctr: 0.03125,
      position: 18.4,
    });
    // PT dates are the UTC date-slice interpreted as PT — non-overlapping,
    // phase-shifted ~7h from the UTC window. See file header for the
    // policy; see toGscDateRange tests for exhaustive cases.
    expect(result.data?.gscStartDate).toBe('2026-04-06');
    expect(result.data?.gscEndDate).toBe('2026-04-12');
    expect(put).toHaveBeenCalledTimes(1);
    // 1 OAuth + 3 search analytics calls (totals + query + page)
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(prepare).toHaveBeenCalled();

    // Verify OAuth call
    const oauthCall = fetchMock.mock.calls.find((c) => {
      const u = typeof c[0] === 'string' ? c[0] : c[0].toString();
      return u.includes('oauth2.googleapis.com');
    }) as [string, RequestInit] | undefined;
    expect(oauthCall).toBeDefined();
    expect(oauthCall![1].body).toContain('grant_type=refresh_token');

    // Verify all three GSC queries use Bearer auth and PT date range
    const gscCalls = fetchMock.mock.calls.filter((c) => {
      const u = typeof c[0] === 'string' ? c[0] : c[0].toString();
      return u.includes('searchAnalytics/query');
    }) as [string, RequestInit][];
    expect(gscCalls.length).toBe(3);
    const seenDimensions = new Set<string>();
    for (const call of gscCalls) {
      const headers = call[1].headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer at-xyz');
      const body = JSON.parse(call[1].body as string);
      // PT-interpreted date range, non-overlapping with adjacent weeks.
      expect(body.startDate).toBe('2026-04-06');
      expect(body.endDate).toBe('2026-04-12');
      const dimKey = (body.dimensions ?? []).join(',') || '<none>';
      seenDimensions.add(dimKey);
    }
    // One of each: totals (no dims), query, page
    expect(seenDimensions).toEqual(new Set(['<none>', 'query', 'page']));
  });

  it('handles empty totals response (zero-traffic week)', async () => {
    const { db } = makeDb({ id: 'snap-1', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    mockGscFetches(
      JSON.stringify({ access_token: 'at-xyz' }),
      null, // no totals row
      [],
      []
    );
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    const result = await runSearchConsoleSnapshot(env, {
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    expect(result.written).toBe(true);
    expect(result.data?.totals).toEqual({
      impressions: 0,
      clicks: 0,
      ctr: 0,
      position: 0,
    });
  });

  it('url-encodes site URLs with special characters like sc-domain: prefix', async () => {
    const { db } = makeDb({ id: 'snap-1', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    const fetchMock = mockGscFetches(
      JSON.stringify({ access_token: 'at-xyz' }),
      null,
      [],
      []
    );
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    await runSearchConsoleSnapshot(env, {
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    const gscCall = fetchMock.mock.calls.find((c) => {
      const u = typeof c[0] === 'string' ? c[0] : c[0].toString();
      return u.includes('searchAnalytics/query');
    });
    expect(gscCall).toBeDefined();
    const urlStr =
      typeof gscCall![0] === 'string' ? gscCall![0] : gscCall![0].toString();
    // The colon in sc-domain: must be url-encoded in the path
    expect(urlStr).toContain('sc-domain%3Aexample.com');
  });

  it('throws and marks snapshot failed when OAuth exchange fails', async () => {
    const { db, run } = makeDb({ id: 'snap-x', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn(
      async () => new Response('invalid_grant', { status: 400 })
    );
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    await expect(
      runSearchConsoleSnapshot(env, {
        windowStart: '2026-04-06T00:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).rejects.toThrow(/Google OAuth token exchange 400/);
    // fail*() invoked
    expect(run).toHaveBeenCalled();
  });

  it('throws when OAuth response lacks an access_token', async () => {
    const { db } = makeDb({ id: 'snap-x', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ scope: 'foo' }), { status: 200 })
    );
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    await expect(
      runSearchConsoleSnapshot(env, {
        windowStart: '2026-04-06T00:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).rejects.toThrow(/missing access_token/);
  });

  it('throws and marks failed when GSC API returns non-2xx', async () => {
    const { db, run } = makeDb({ id: 'snap-x', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const s = typeof url === 'string' ? url : url.toString();
      if (s.includes('oauth2.googleapis.com')) {
        return new Response(JSON.stringify({ access_token: 'at' }), { status: 200 });
      }
      return new Response('forbidden', { status: 403 });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    await expect(
      runSearchConsoleSnapshot(env, {
        windowStart: '2026-04-06T00:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).rejects.toThrow(/Google Search Console API 403/);
    expect(run).toHaveBeenCalled();
  });

  it('returns reclaimed result when complete*() reports zero changes', async () => {
    const { db } = makeDb({ id: 'snap-y', attempt_count: 1 }, 0);
    const { kv } = makeKv();
    mockGscFetches(JSON.stringify({ access_token: 'at' }), null, [], []);
    const env = {
      DB: db,
      KV: kv,
      GSC_CLIENT_ID: 'id',
      GSC_CLIENT_SECRET: 'secret',
      GSC_REFRESH_TOKEN: 'refresh',
      GSC_SITE_URL: 'sc-domain:example.com',
    } as unknown as Env;
    const result = await runSearchConsoleSnapshot(env, {
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/reclaimed/);
  });
});
