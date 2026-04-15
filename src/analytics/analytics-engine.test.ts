import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  buildRollupQuery,
  resolveRollupWindow,
  runArticleViewsRollup,
  writeArticleViewEvent,
} from './analytics-engine';
import type { Env } from '../types';

describe('resolveRollupWindow', () => {
  it('defaults to [today_midnight - 7 days, today_midnight)', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    const result = resolveRollupWindow(now);
    expect(result.fromDate).toBe('2026-04-08');
    expect(result.toDate).toBe('2026-04-15');
  });

  it('honors custom days', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    const result = resolveRollupWindow(now, { days: 14 });
    expect(result.fromDate).toBe('2026-04-01');
    expect(result.toDate).toBe('2026-04-15');
  });

  it('honors explicit fromDate and toDate', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    const result = resolveRollupWindow(now, {
      fromDate: '2026-03-01',
      toDate: '2026-04-01',
    });
    expect(result).toEqual({ fromDate: '2026-03-01', toDate: '2026-04-01' });
  });

  it('throws when toDate is in the future (would write incomplete data)', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    expect(() => resolveRollupWindow(now, { toDate: '2026-04-16' })).toThrow(
      /in the future/
    );
  });

  it('throws when toDate equals tomorrow even by one day', () => {
    const now = new Date('2026-04-15T23:59:59.000Z');
    expect(() => resolveRollupWindow(now, { toDate: '2026-04-16' })).toThrow();
  });

  it('allows toDate equal to today midnight (exclusive of today)', () => {
    const now = new Date('2026-04-15T00:00:01.000Z');
    const result = resolveRollupWindow(now, { toDate: '2026-04-15' });
    expect(result.toDate).toBe('2026-04-15');
  });

  it('throws when fromDate >= toDate (empty window)', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    expect(() =>
      resolveRollupWindow(now, { fromDate: '2026-04-10', toDate: '2026-04-10' })
    ).toThrow(/empty/);
  });

  it('throws on malformed date strings', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    expect(() => resolveRollupWindow(now, { toDate: '04/15/2026' })).toThrow(
      /YYYY-MM-DD/
    );
  });

  it('throws on impossible calendar dates (parse-and-round-trip)', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    // Day-of-month overflow
    expect(() => resolveRollupWindow(now, { toDate: '2026-02-31' })).toThrow(
      /YYYY-MM-DD/
    );
    expect(() => resolveRollupWindow(now, { toDate: '2026-04-31' })).toThrow();
    expect(() => resolveRollupWindow(now, { toDate: '2026-04-32' })).toThrow();
    // Month overflow
    expect(() => resolveRollupWindow(now, { toDate: '2026-13-01' })).toThrow();
    expect(() => resolveRollupWindow(now, { toDate: '2026-00-15' })).toThrow();
    // Non-leap-year Feb 29
    expect(() => resolveRollupWindow(now, { toDate: '2025-02-29' })).toThrow();
    // Same checks on fromDate
    expect(() =>
      resolveRollupWindow(now, { fromDate: '2026-02-31', toDate: '2026-04-15' })
    ).toThrow();
  });

  it('accepts leap-year Feb 29', () => {
    const now = new Date('2028-04-15T13:42:00.000Z');
    expect(() =>
      resolveRollupWindow(now, { fromDate: '2028-02-29', toDate: '2028-04-15' })
    ).not.toThrow();
  });

  it('throws on non-positive days', () => {
    const now = new Date('2026-04-15T13:42:00.000Z');
    expect(() => resolveRollupWindow(now, { days: 0 })).toThrow();
    expect(() => resolveRollupWindow(now, { days: -1 })).toThrow();
  });
});

describe('buildRollupQuery', () => {
  it('uses half-open whole-day bounds', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain("timestamp >= toDateTime('2026-04-08 00:00:00')");
    expect(sql).toContain("timestamp < toDateTime('2026-04-15 00:00:00')");
  });

  it('uses SUM(_sample_interval) instead of count() for sampling correctness', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain('SUM(_sample_interval) AS views');
    expect(sql).not.toMatch(/\bcount\(\) AS views\b/);
  });

  it('selects article_id, view_date, views from the right blob positions', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain('blob1 AS article_id');
    expect(sql).toContain("formatDateTime(timestamp, '%Y-%m-%d') AS view_date");
  });

  it('filters out bot user-agents in the WHERE clause', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain("lower(blob4) NOT LIKE '%bot%'");
    expect(sql).toContain("lower(blob4) NOT LIKE '%crawl%'");
    expect(sql).toContain("lower(blob4) NOT LIKE '%spider%'");
    expect(sql).toContain("lower(blob4) NOT LIKE '%scrape%'");
  });

  it('groups and orders by article_id and view_date', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain('GROUP BY article_id, view_date');
    expect(sql).toContain('ORDER BY view_date DESC, views DESC');
  });

  it('caps results at the configured row limit', () => {
    const sql = buildRollupQuery('2026-04-08', '2026-04-15');
    expect(sql).toContain('LIMIT 10000');
  });
});

describe('writeArticleViewEvent', () => {
  it('no-ops when AE_EVENTS binding is missing', () => {
    const env = { AE_EVENTS: undefined } as unknown as Env;
    expect(() =>
      writeArticleViewEvent(env, {
        articleId: 'abc',
        referer: null,
        country: null,
        userAgent: null,
      })
    ).not.toThrow();
  });

  it('writes blobs in the documented order with article id index', () => {
    const writeDataPoint = vi.fn();
    const env = {
      AE_EVENTS: { writeDataPoint },
    } as unknown as Env;
    writeArticleViewEvent(env, {
      articleId: 'article-123',
      referer: 'https://news.ycombinator.com/item?id=1',
      country: 'US',
      userAgent: 'Mozilla/5.0',
    });
    expect(writeDataPoint).toHaveBeenCalledTimes(1);
    const call = writeDataPoint.mock.calls[0][0];
    expect(call.blobs[0]).toBe('article-123');
    expect(call.blobs[1]).toBe('news.ycombinator.com');
    expect(call.blobs[2]).toBe('US');
    expect(call.blobs[3]).toBe('Mozilla/5.0');
    expect(call.indexes[0]).toBe('article-123');
    expect(call.doubles[0]).toBe(1);
  });

  it('falls back to "direct" for missing referer and "unknown" for missing country', () => {
    const writeDataPoint = vi.fn();
    const env = { AE_EVENTS: { writeDataPoint } } as unknown as Env;
    writeArticleViewEvent(env, {
      articleId: 'abc',
      referer: null,
      country: null,
      userAgent: null,
    });
    const call = writeDataPoint.mock.calls[0][0];
    expect(call.blobs[1]).toBe('direct');
    expect(call.blobs[2]).toBe('unknown');
    expect(call.blobs[3]).toBe('');
  });

  it('truncates oversized user-agent strings to 256 chars', () => {
    const writeDataPoint = vi.fn();
    const env = { AE_EVENTS: { writeDataPoint } } as unknown as Env;
    writeArticleViewEvent(env, {
      articleId: 'abc',
      referer: null,
      country: null,
      userAgent: 'X'.repeat(500),
    });
    expect(writeDataPoint.mock.calls[0][0].blobs[3].length).toBe(256);
  });

  it('swallows binding errors so serving never breaks', () => {
    const writeDataPoint = vi.fn(() => {
      throw new Error('binding exploded');
    });
    const env = { AE_EVENTS: { writeDataPoint } } as unknown as Env;
    expect(() =>
      writeArticleViewEvent(env, {
        articleId: 'abc',
        referer: null,
        country: null,
        userAgent: null,
      })
    ).not.toThrow();
  });
});

describe('runArticleViewsRollup', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('throws if CF_ACCOUNT_ID or CF_ANALYTICS_API_TOKEN is missing', async () => {
    const env = { DB: {}, CF_ACCOUNT_ID: undefined } as unknown as Env;
    await expect(runArticleViewsRollup(env)).rejects.toThrow(
      /CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN/
    );
  });

  it('upserts valid rows from the SQL API response', async () => {
    const batched: unknown[][] = [];
    const prepare = vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
    });
    const db = {
      prepare,
      batch: vi.fn(async (stmts: unknown[]) => {
        batched.push(stmts);
        return [];
      }),
    } as unknown as D1Database;

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [
            { article_id: 'a1', view_date: '2026-04-14', views: 12 },
            { article_id: 'a2', view_date: '2026-04-14', views: 5 },
            { article_id: '', view_date: '2026-04-14', views: 99 }, // dropped
            { article_id: 'a3', view_date: '', views: 7 }, // dropped
          ],
          rows: 4,
          rows_before_limit_at_least: 4,
        }),
        { status: 200 }
      )
    );

    const env = {
      DB: db,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;

    const result = await runArticleViewsRollup(env, {
      fromDate: '2026-04-08',
      toDate: '2026-04-15',
    });
    expect(result.rowsScanned).toBe(4);
    expect(result.rowsWritten).toBe(2);
    expect(result.fromDate).toBe('2026-04-08');
    expect(result.toDate).toBe('2026-04-15');
    expect(result.rowsBeforeLimit).toBe(4);
    expect(prepare).toHaveBeenCalledTimes(2);
    expect(batched.length).toBe(1);
    expect(batched[0].length).toBe(2);
  });

  it('throws BEFORE upserting if rows_before_limit_at_least exceeds returned rows', async () => {
    const prepare = vi.fn();
    const batch = vi.fn();
    const db = { prepare, batch } as unknown as D1Database;

    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ article_id: 'a1', view_date: '2026-04-14', views: 1 }],
          rows: 1,
          rows_before_limit_at_least: 12345,
        }),
        { status: 200 }
      )
    );

    const env = {
      DB: db,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;

    await expect(
      runArticleViewsRollup(env, {
        fromDate: '2026-04-08',
        toDate: '2026-04-15',
      })
    ).rejects.toThrow(/hit the row limit/);
    // Critically: no upserts happened. Partial rollup state must never land.
    expect(prepare).not.toHaveBeenCalled();
    expect(batch).not.toHaveBeenCalled();
  });

  it('does not throw when rows_before_limit_at_least equals returned rows', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({ bind: vi.fn().mockReturnThis() }),
      batch: vi.fn(async () => []),
    } as unknown as D1Database;
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          data: [{ article_id: 'a1', view_date: '2026-04-14', views: 1 }],
          rows: 1,
          rows_before_limit_at_least: 1,
        }),
        { status: 200 }
      )
    );
    const env = {
      DB: db,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    const result = await runArticleViewsRollup(env, {
      fromDate: '2026-04-08',
      toDate: '2026-04-15',
    });
    expect(result.rowsWritten).toBe(1);
  });

  it('throws with the upstream error body on non-2xx responses', async () => {
    globalThis.fetch = vi.fn(
      async () => new Response('bad token', { status: 401 })
    );
    const env = {
      DB: {},
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    await expect(
      runArticleViewsRollup(env, { fromDate: '2026-04-08', toDate: '2026-04-15' })
    ).rejects.toThrow(/Analytics Engine SQL API 401/);
  });

  it('handles empty result sets without calling batch', async () => {
    const batch = vi.fn();
    const db = {
      prepare: vi.fn(),
      batch,
    } as unknown as D1Database;
    globalThis.fetch = vi.fn(
      async () => new Response(JSON.stringify({ data: [] }), { status: 200 })
    );
    const env = {
      DB: db,
      CF_ACCOUNT_ID: 'acct',
      CF_ANALYTICS_API_TOKEN: 'tok',
    } as unknown as Env;
    const result = await runArticleViewsRollup(env, {
      fromDate: '2026-04-08',
      toDate: '2026-04-15',
    });
    expect(result.rowsWritten).toBe(0);
    expect(batch).not.toHaveBeenCalled();
  });
});
