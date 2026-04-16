import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildAnalyticsQuery,
  fetchCfAnalytics,
  parseAnalyticsResponse,
  resolveSnapshotWindow,
  runCfAnalyticsSnapshot,
} from './cloudflare';
import type { Env } from '../types';

describe('buildAnalyticsQuery', () => {
  it('queries httpRequests1dGroups with four aliased subqueries', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('totals: httpRequests1dGroups');
    expect(q).toContain('paths: httpRequests1dGroups');
    expect(q).toContain('countries: httpRequests1dGroups');
    expect(q).toContain('statuses: httpRequests1dGroups');
    // cacheStatus dimension not available on free/pro; cachedRequests
    // comes from sum.cachedRequests in the totals row instead.
    expect(q).not.toContain('cacheStatuses');
  });

  it('uses date_geq + date_lt half-open bounds (not datetime)', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('date_geq: $start, date_lt: $end');
    expect(q).not.toContain('datetime_geq');
  });

  it('uses httpRequests1dGroups fields: sum.requests, sum.pageViews, uniq.uniques', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('sum { requests pageViews bytes cachedRequests }');
    expect(q).toContain('uniq { uniques }');
    expect(q).toMatch(/paths:[\s\S]*sum \{ requests pageViews \}/);
  });

  it('selects the right dimensions for each grouped subquery', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('dimensions { clientRequestPath }');
    expect(q).toContain('dimensions { clientCountryName }');
    expect(q).toContain('dimensions { edgeResponseStatus }');
    // clientRequestReferer and cacheStatus dimensions are NOT available
    // on httpRequests1dGroups for free/pro zones.
    expect(q).not.toContain('clientRequestReferer');
    expect(q).not.toContain('cacheStatus');
  });

  it('orders top-N subqueries by sum_requests_DESC', () => {
    const q = buildAnalyticsQuery();
    expect(q.match(/orderBy: \[sum_requests_DESC\]/g)?.length).toBe(3);
  });

  it('uses Date! variable types for the date filter', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('$start: Date!');
    expect(q).toContain('$end: Date!');
  });
});

describe('resolveSnapshotWindow', () => {
  it('canonicalizes equivalent-instant strings to the same UTC ISO form', () => {
    const a = resolveSnapshotWindow({
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    const b = resolveSnapshotWindow({
      windowStart: '2026-04-05T14:00:00-10:00',
      windowEnd: '2026-04-12T14:00:00-10:00',
    });
    expect(a).toEqual(b);
    expect(a.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(a.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });

  it('round-trips ISO strings with fractional seconds', () => {
    const result = resolveSnapshotWindow({
      windowStart: '2026-04-06T00:00:00.000Z',
      windowEnd: '2026-04-13T00:00:00.000Z',
    });
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });

  it('rejects unparseable strings', () => {
    expect(() =>
      resolveSnapshotWindow({
        windowStart: 'not-a-date',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601 timestamps/);
  });

  it('rejects timezone-less ISO strings (ambiguous, locale-dependent)', () => {
    // Without an explicit Z or offset, Date.parse interprets in the runtime's
    // local timezone. In a non-UTC runtime this canonicalizes to an
    // off-boundary window that lands in a different UNIQUE slot.
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2026-04-06T00:00:00',
        windowEnd: '2026-04-13T00:00:00',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('rejects non-ISO human-readable forms', () => {
    expect(() =>
      resolveSnapshotWindow({
        windowStart: 'April 6, 2026',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('rejects impossible calendar dates', () => {
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2026-02-31T00:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2026-04-06T00:00:00Z',
        windowEnd: '2026-13-01T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
    // Feb 29 in a non-leap year
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2025-02-29T00:00:00Z',
        windowEnd: '2025-03-08T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('accepts leap-year Feb 29', () => {
    const result = resolveSnapshotWindow({
      windowStart: '2028-02-29T00:00:00Z',
      windowEnd: '2028-03-07T00:00:00Z',
    });
    expect(result.windowStart).toBe('2028-02-29T00:00:00.000Z');
  });

  it('rejects impossible time components', () => {
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2026-04-06T25:00:00Z',
        windowEnd: '2026-04-13T00:00:00Z',
      })
    ).toThrow(/strict ISO 8601/);
  });

  it('accepts explicit +00:00 offset as equivalent to Z', () => {
    const a = resolveSnapshotWindow({
      windowStart: '2026-04-06T00:00:00Z',
      windowEnd: '2026-04-13T00:00:00Z',
    });
    const b = resolveSnapshotWindow({
      windowStart: '2026-04-06T00:00:00+00:00',
      windowEnd: '2026-04-13T00:00:00+00:00',
    });
    expect(a).toEqual(b);
  });

  it('rejects empty windows (start >= end)', () => {
    expect(() =>
      resolveSnapshotWindow({
        windowStart: '2026-04-13T00:00:00Z',
        windowEnd: '2026-04-06T00:00:00Z',
      })
    ).toThrow(/empty/);
  });

  it('rejects half-specified windows', () => {
    expect(() =>
      resolveSnapshotWindow({ windowStart: '2026-04-06T00:00:00Z' })
    ).toThrow(/both be provided or both omitted/);
  });
});

describe('parseAnalyticsResponse', () => {
  const input = {
    windowStart: '2026-04-06T00:00:00.000Z',
    windowEnd: '2026-04-13T00:00:00.000Z',
    zoneTag: 'zone-abc',
  };

  it('extracts totals from sum.requests / sum.pageViews / uniq.uniques', () => {
    const json = {
      data: {
        viewer: {
          zones: [
            {
              totals: [
                {
                  sum: {
                    requests: 12000,
                    pageViews: 9500,
                    bytes: 5_000_000,
                    cachedRequests: 8400,
                  },
                  uniq: { uniques: 2200 },
                },
              ],
              paths: [
                {
                  sum: { requests: 4000, pageViews: 4000 },
                  dimensions: { clientRequestPath: '/' },
                },
                {
                  sum: { requests: 800, pageViews: 800 },
                  dimensions: { clientRequestPath: '/article/abc' },
                },
              ],
              countries: [
                {
                  sum: { requests: 7500 },
                  dimensions: { clientCountryName: 'United States' },
                },
              ],
              statuses: [
                {
                  sum: { requests: 11500 },
                  dimensions: { edgeResponseStatus: '200' },
                },
                {
                  sum: { requests: 250 },
                  dimensions: { edgeResponseStatus: '404' },
                },
              ],
            },
          ],
        },
      },
    };
    const result = parseAnalyticsResponse(json, input);
    expect(result.windowStart).toBe(input.windowStart);
    expect(result.windowEnd).toBe(input.windowEnd);
    expect(result.zoneTag).toBe(input.zoneTag);
    expect(result.totals).toEqual({
      requests: 12000,
      pageViews: 9500,
      uniqueVisitors: 2200,
      bytes: 5_000_000,
      cachedRequests: 8400,
    });
    expect(result.topPaths).toEqual([
      { key: '/', requests: 4000, pageViews: 4000 },
      { key: '/article/abc', requests: 800, pageViews: 800 },
    ]);
    expect(result.topCountries).toEqual([
      { key: 'United States', requests: 7500 },
    ]);
    expect(result.statusCodes).toEqual([
      { key: '200', requests: 11500 },
      { key: '404', requests: 250 },
    ]);
  });

  it('returns zeroed totals and empty arrays when zone has no data', () => {
    const result = parseAnalyticsResponse(
      { data: { viewer: { zones: [] } } },
      input
    );
    expect(result.totals).toEqual({
      requests: 0,
      pageViews: 0,
      uniqueVisitors: 0,
      bytes: 0,
      cachedRequests: 0,
    });
    expect(result.topPaths).toEqual([]);
    expect(result.topCountries).toEqual([]);
    expect(result.statusCodes).toEqual([]);
  });

  it('survives missing dimensions or sum sub-objects without throwing', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                paths: [{}, { dimensions: {} }, { sum: { requests: 5 } }],
              },
            ],
          },
        },
      },
      input
    );
    expect(result.topPaths).toEqual([
      { key: '', requests: 0, pageViews: 0 },
      { key: '', requests: 0, pageViews: 0 },
      { key: '', requests: 5, pageViews: 0 },
    ]);
  });

  it('coerces numeric strings', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                totals: [
                  {
                    sum: {
                      requests: '12345' as unknown as number,
                      pageViews: '6789' as unknown as number,
                    },
                  },
                ],
              },
            ],
          },
        },
      },
      input
    );
    expect(result.totals.requests).toBe(12345);
    expect(result.totals.pageViews).toBe(6789);
  });
});

describe('fetchCfAnalytics', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to the CF GraphQL endpoint with bearer auth and JSON body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ data: { viewer: { zones: [] } } }), {
        status: 200,
      })
    );
    globalThis.fetch = fetchMock;
    const env = {
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;

    await fetchCfAnalytics(env, {
      windowStart: '2026-04-06T00:00:00.000Z',
      windowEnd: '2026-04-13T00:00:00.000Z',
      zoneTag: 'zone-abc',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer tok');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.query).toContain('httpRequests1dGroups');
    expect(body.variables.zoneTag).toBe('zone-abc');
    expect(body.variables.start).toBe('2026-04-06');
    expect(body.variables.end).toBe('2026-04-13');
  });

  it('throws on non-2xx responses with a truncated body', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('forbidden', { status: 403 })
    );
    const env = {
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    await expect(
      fetchCfAnalytics(env, {
        windowStart: '2026-04-06T00:00:00.000Z',
        windowEnd: '2026-04-13T00:00:00.000Z',
        zoneTag: 'zone-abc',
      })
    ).rejects.toThrow(/CF GraphQL 403/);
  });

  it('throws when the response contains a GraphQL errors array', async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ errors: [{ message: 'unknown field foo' }] }),
          { status: 200 }
        )
    );
    const env = {
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    await expect(
      fetchCfAnalytics(env, {
        windowStart: '2026-04-06T00:00:00.000Z',
        windowEnd: '2026-04-13T00:00:00.000Z',
        zoneTag: 'zone-abc',
      })
    ).rejects.toThrow(/CF GraphQL error: unknown field foo/);
  });
});

describe('runCfAnalyticsSnapshot', () => {
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
    return {
      db: {
        prepare,
      } as unknown as D1Database,
      first,
      run,
      prepare,
    };
  }

  function makeKv() {
    const put = vi.fn(async () => undefined);
    return { kv: { put } as unknown as KVNamespace, put };
  }

  it('throws if CF_ACCOUNT_ID or CF_ANALYTICS_API_TOKEN is missing', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    await expect(runCfAnalyticsSnapshot(env)).rejects.toThrow(
      /CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN/
    );
  });

  it('throws if zone tag is not provided via env or options', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    await expect(runCfAnalyticsSnapshot(env)).rejects.toThrow(/zoneTag/);
  });

  it('returns no-op when claim returns null (window already complete)', async () => {
    const { db } = makeDb(null);
    const { kv } = makeKv();
    const env = {
      DB: db,
      KV: kv,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    const result = await runCfAnalyticsSnapshot(env, {
      windowStart: '2026-04-06T00:00:00.000Z',
      windowEnd: '2026-04-13T00:00:00.000Z',
    });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/already complete/);
  });

  it('writes blob and completes snapshot when claim succeeds', async () => {
    const { db, prepare, run } = makeDb({ id: 'snap-1', attempt_count: 1 }, 1);
    const { kv, put } = makeKv();
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            data: {
              viewer: {
                zones: [
                  {
                    totals: [
                      {
                        sum: {
                          requests: 1000,
                          pageViews: 800,
                          bytes: 50000,
                          cachedRequests: 700,
                        },
                        uniq: { uniques: 200 },
                      },
                    ],
                    paths: [
                      {
                        sum: { requests: 500, pageViews: 500 },
                        dimensions: { clientRequestPath: '/' },
                      },
                    ],
                    countries: [],
                    statuses: [],
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
    );
    const env = {
      DB: db,
      KV: kv,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    const result = await runCfAnalyticsSnapshot(env, {
      windowStart: '2026-04-06T00:00:00.000Z',
      windowEnd: '2026-04-13T00:00:00.000Z',
    });
    expect(result.written).toBe(true);
    expect(result.blobKey).toBe('cf-analytics/2026-04-06T00:00:00.000Z/snap-1.json');
    expect(put).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });

  it('marks snapshot failed and rethrows when fetch errors', async () => {
    const { db, run } = makeDb({ id: 'snap-x', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn(
      async () => new Response('boom', { status: 500 })
    );
    const env = {
      DB: db,
      KV: kv,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    await expect(
      runCfAnalyticsSnapshot(env, {
        windowStart: '2026-04-06T00:00:00.000Z',
        windowEnd: '2026-04-13T00:00:00.000Z',
      })
    ).rejects.toThrow(/CF GraphQL 500/);
    // fail*() was invoked — at least one .run() call happened (the failure update)
    expect(run).toHaveBeenCalled();
  });

  it('returns reclaimed result when complete*() reports zero changes', async () => {
    const { db } = makeDb({ id: 'snap-y', attempt_count: 1 }, 0);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ data: { viewer: { zones: [] } } }),
          { status: 200 }
        )
    );
    const env = {
      DB: db,
      KV: kv,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    const result = await runCfAnalyticsSnapshot(env, {
      windowStart: '2026-04-06T00:00:00.000Z',
      windowEnd: '2026-04-13T00:00:00.000Z',
    });
    expect(result.written).toBe(false);
    expect(result.reason).toMatch(/reclaimed/);
  });

  it('rejects when only one of windowStart/windowEnd is provided', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    await expect(
      runCfAnalyticsSnapshot(env, { windowStart: '2026-04-06T00:00:00.000Z' })
    ).rejects.toThrow(/both be provided or both omitted/);
  });

  it('rejects when window is empty', async () => {
    const env = {
      DB: {} as D1Database,
      KV: {} as KVNamespace,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
      CF_ZONE_ID: 'zone',
    } as unknown as Env;
    await expect(
      runCfAnalyticsSnapshot(env, {
        windowStart: '2026-04-13T00:00:00.000Z',
        windowEnd: '2026-04-06T00:00:00.000Z',
      })
    ).rejects.toThrow(/empty/);
  });
});
