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
  it('queries httpRequestsAdaptiveGroups with six aliased subqueries', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('totals: httpRequestsAdaptiveGroups');
    expect(q).toContain('cacheStatuses: httpRequestsAdaptiveGroups');
    expect(q).toContain('paths: httpRequestsAdaptiveGroups');
    expect(q).toContain('referrers: httpRequestsAdaptiveGroups');
    expect(q).toContain('countries: httpRequestsAdaptiveGroups');
    expect(q).toContain('statuses: httpRequestsAdaptiveGroups');
  });

  it('uses datetime_geq + datetime_lt half-open bounds', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('datetime_geq: $start, datetime_lt: $end');
  });

  it('uses the CF-documented fields: count, sum.visits, sum.edgeResponseBytes', () => {
    const q = buildAnalyticsQuery();
    // count is a top-level field on the group, not inside sum
    expect(q).toMatch(/\bcount\b/);
    // visits is the pageview equivalent on adaptive groups
    expect(q).toContain('sum { visits edgeResponseBytes }');
    // in the paths subquery, sum { visits } is also fetched
    expect(q).toMatch(/paths:[\s\S]*sum \{ visits \}/);
  });

  it('does NOT use the non-existent fields from the reviewer-flagged schema', () => {
    const q = buildAnalyticsQuery();
    // sum.requests / sum.pageViews / sum.cachedRequests do not exist on adaptive groups
    expect(q).not.toMatch(/sum \{[^}]*\brequests\b/);
    expect(q).not.toMatch(/\bpageViews\b/);
    expect(q).not.toMatch(/\bcachedRequests\b/);
    // uniq.uniques is explicitly not supported on this node
    expect(q).not.toMatch(/\buniq\b/);
    expect(q).not.toMatch(/\buniques\b/);
  });

  it('selects the right dimensions for each grouped subquery', () => {
    const q = buildAnalyticsQuery();
    expect(q).toContain('dimensions { clientRequestPath }');
    expect(q).toContain('dimensions { clientRequestReferer }');
    expect(q).toContain('dimensions { clientCountryName }');
    expect(q).toContain('dimensions { edgeResponseStatus }');
    expect(q).toContain('dimensions { cacheStatus }');
  });

  it('orders top-N subqueries by count descending (not sum_requests)', () => {
    const q = buildAnalyticsQuery();
    expect(q.match(/orderBy: \[count_DESC\]/g)?.length).toBe(5);
    expect(q).not.toContain('sum_requests_DESC');
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

  it('extracts totals from count / sum.visits / sum.edgeResponseBytes', () => {
    const json = {
      data: {
        viewer: {
          zones: [
            {
              totals: [
                {
                  count: 12000,
                  sum: { visits: 9500, edgeResponseBytes: 5_000_000 },
                },
              ],
              cacheStatuses: [
                { count: 8400, dimensions: { cacheStatus: 'hit' } },
                { count: 2600, dimensions: { cacheStatus: 'miss' } },
                { count: 1000, dimensions: { cacheStatus: 'dynamic' } },
              ],
              paths: [
                {
                  count: 4000,
                  dimensions: { clientRequestPath: '/' },
                  sum: { visits: 4000 },
                },
                {
                  count: 800,
                  dimensions: { clientRequestPath: '/article/abc' },
                  sum: { visits: 800 },
                },
              ],
              referrers: [
                {
                  count: 600,
                  dimensions: {
                    clientRequestReferer: 'https://news.ycombinator.com/',
                  },
                },
              ],
              countries: [
                {
                  count: 7500,
                  dimensions: { clientCountryName: 'United States' },
                },
              ],
              statuses: [
                { count: 11500, dimensions: { edgeResponseStatus: '200' } },
                { count: 250, dimensions: { edgeResponseStatus: '404' } },
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
      visits: 9500,
      bytes: 5_000_000,
      cachedRequests: 8400,
    });
    expect(result.topPaths).toEqual([
      { key: '/', requests: 4000, visits: 4000 },
      { key: '/article/abc', requests: 800, visits: 800 },
    ]);
    expect(result.topReferrers).toEqual([
      { key: 'https://news.ycombinator.com/', requests: 600 },
    ]);
    expect(result.topCountries).toEqual([
      { key: 'United States', requests: 7500 },
    ]);
    expect(result.statusCodes).toEqual([
      { key: '200', requests: 11500 },
      { key: '404', requests: 250 },
    ]);
    expect(result.cacheStatuses).toEqual([
      { key: 'hit', requests: 8400 },
      { key: 'miss', requests: 2600 },
      { key: 'dynamic', requests: 1000 },
    ]);
  });

  it('sums all served-from-cache statuses (hit + stale + updating + revalidated)', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                totals: [{ count: 2000 }],
                cacheStatuses: [
                  { count: 400, dimensions: { cacheStatus: 'hit' } },
                  { count: 250, dimensions: { cacheStatus: 'stale' } },
                  { count: 150, dimensions: { cacheStatus: 'updating' } },
                  { count: 100, dimensions: { cacheStatus: 'revalidated' } },
                  { count: 900, dimensions: { cacheStatus: 'miss' } },
                  { count: 200, dimensions: { cacheStatus: 'dynamic' } },
                ],
              },
            ],
          },
        },
      },
      input
    );
    // 400 + 250 + 150 + 100 = 900
    expect(result.totals.cachedRequests).toBe(900);
  });

  it('is case-insensitive when matching cacheStatus keys', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                totals: [{ count: 100 }],
                cacheStatuses: [
                  { count: 30, dimensions: { cacheStatus: 'HIT' } },
                  { count: 20, dimensions: { cacheStatus: 'Stale' } },
                ],
              },
            ],
          },
        },
      },
      input
    );
    expect(result.totals.cachedRequests).toBe(50);
  });

  it('excludes non-cached statuses from cachedRequests', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                totals: [{ count: 1000 }],
                cacheStatuses: [
                  { count: 400, dimensions: { cacheStatus: 'hit' } },
                  { count: 300, dimensions: { cacheStatus: 'miss' } },
                  { count: 200, dimensions: { cacheStatus: 'bypass' } },
                  { count: 100, dimensions: { cacheStatus: 'dynamic' } },
                ],
              },
            ],
          },
        },
      },
      input
    );
    expect(result.totals.cachedRequests).toBe(400);
  });

  it('treats missing cacheStatuses array as zero cachedRequests', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [{ totals: [{ count: 500 }] }],
          },
        },
      },
      input
    );
    expect(result.totals.cachedRequests).toBe(0);
  });

  it('returns zeroed totals and empty arrays when zone has no data', () => {
    const result = parseAnalyticsResponse(
      { data: { viewer: { zones: [] } } },
      input
    );
    expect(result.totals).toEqual({
      requests: 0,
      visits: 0,
      bytes: 0,
      cachedRequests: 0,
    });
    expect(result.topPaths).toEqual([]);
    expect(result.topReferrers).toEqual([]);
    expect(result.topCountries).toEqual([]);
    expect(result.statusCodes).toEqual([]);
    expect(result.cacheStatuses).toEqual([]);
  });

  it('survives missing dimensions or sum sub-objects without throwing', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                paths: [{}, { dimensions: {} }, { count: 5 }],
              },
            ],
          },
        },
      },
      input
    );
    expect(result.topPaths).toEqual([
      { key: '', requests: 0, visits: 0 },
      { key: '', requests: 0, visits: 0 },
      { key: '', requests: 5, visits: 0 },
    ]);
  });

  it('coerces numeric strings (CF GraphQL sometimes returns counts as strings)', () => {
    const result = parseAnalyticsResponse(
      {
        data: {
          viewer: {
            zones: [
              {
                totals: [
                  {
                    count: '12345' as unknown as number,
                    sum: { visits: '6789' as unknown as number },
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
    expect(result.totals.visits).toBe(6789);
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
    expect(body.query).toContain('httpRequestsAdaptiveGroups');
    expect(body.variables.zoneTag).toBe('zone-abc');
    expect(body.variables.start).toBe('2026-04-06T00:00:00.000Z');
    expect(body.variables.end).toBe('2026-04-13T00:00:00.000Z');
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
                        count: 1000,
                        sum: { visits: 800, edgeResponseBytes: 50000 },
                      },
                    ],
                    cacheStatuses: [
                      { count: 700, dimensions: { cacheStatus: 'hit' } },
                      { count: 300, dimensions: { cacheStatus: 'miss' } },
                    ],
                    paths: [
                      {
                        count: 500,
                        dimensions: { clientRequestPath: '/' },
                        sum: { visits: 500 },
                      },
                    ],
                    referrers: [],
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
