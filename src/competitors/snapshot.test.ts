import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  resolveCompetitorWindow,
  runCompetitorSnapshots,
} from './snapshot';
import type { CompetitorConfig } from './config';
import type { Env } from '../types';

describe('resolveCompetitorWindow', () => {
  it('resolves an override to the week CONTAINING that instant', () => {
    // Wednesday 2026-04-08 is inside the week of Mon Apr 6 – Sun Apr 12
    const result = resolveCompetitorWindow({
      windowStart: '2026-04-08T00:00:00Z',
    });
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });

  it('resolves a Monday exactly to the week starting that Monday', () => {
    const result = resolveCompetitorWindow({
      windowStart: '2026-04-06T00:00:00Z',
    });
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });

  it('canonicalizes non-UTC offsets to the correct weekly bucket', () => {
    // 2026-04-05T14:00:00-10:00 = 2026-04-06T00:00:00Z (Monday)
    // → week of Apr 6
    const result = resolveCompetitorWindow({
      windowStart: '2026-04-05T14:00:00-10:00',
    });
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');
    expect(result.windowEnd).toBe('2026-04-13T00:00:00.000Z');
  });

  it('defaults to previous complete weekly window when no override', () => {
    const result = resolveCompetitorWindow({});
    expect(result.windowStart.endsWith('T00:00:00.000Z')).toBe(true);
    expect(result.windowEnd.endsWith('T00:00:00.000Z')).toBe(true);
    const startMs = Date.parse(result.windowStart);
    const endMs = Date.parse(result.windowEnd);
    expect(endMs - startMs).toBe(7 * 24 * 60 * 60 * 1000);
  });

  it('rejects timezone-less ISO strings', () => {
    expect(() =>
      resolveCompetitorWindow({ windowStart: '2026-04-06T00:00:00' })
    ).toThrow(/strict ISO 8601/);
  });
});

describe('runCompetitorSnapshots', () => {
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

  const testCompetitor: CompetitorConfig = {
    slug: 'test-comp',
    name: 'Test Competitor',
    homepageUrl: 'https://test.example/',
    rssUrl: null,
    bucket: 'direct',
  };

  const testCompetitorWithRss: CompetitorConfig = {
    ...testCompetitor,
    slug: 'test-rss',
    rssUrl: 'https://test.example/feed.xml',
  };

  it('returns no-op when claim returns null (window already complete)', async () => {
    const { db } = makeDb(null);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(async () =>
      new Response('<html><h2>Title</h2></html>', { status: 200 })
    );
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitor],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.skippedCount).toBe(1);
    expect(result.completedCount).toBe(0);
    expect(result.results[0].written).toBe(false);
    expect(result.results[0].reason).toMatch(/already complete/);
  });

  it('fetches homepage, writes blob and snapshot for a no-RSS competitor', async () => {
    const { db, prepare } = makeDb({ id: 'snap-1', attempt_count: 1 }, 1);
    const { kv, put } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(async () =>
      new Response(
        '<html><h2><a href="/article/1">Test Article</a></h2></html>',
        { status: 200 }
      )
    );
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitor],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.completedCount).toBe(1);
    expect(result.results[0].written).toBe(true);
    expect(result.results[0].itemsCount).toBe(1);
    expect(result.results[0].blobKey).toContain('competitors/');
    expect(put).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalled();
  });

  it('prefers RSS content over homepage scraping when RSS is available', async () => {
    const { db } = makeDb({ id: 'snap-2', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('feed.xml')) {
        return new Response(
          `<rss><channel>
            <item><title>RSS Item</title><link>https://test.example/rss</link></item>
          </channel></rss>`,
          { status: 200 }
        );
      }
      return new Response(
        '<html><h2><a href="/page">Page Item</a></h2></html>',
        { status: 200 }
      );
    });
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitorWithRss],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.results[0].written).toBe(true);
    // RSS was available, so items come from RSS not homepage scraping
    expect(result.results[0].itemsCount).toBe(1);
  });

  it('falls back to homepage when RSS fetch fails', async () => {
    const { db } = makeDb({ id: 'snap-3', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.includes('feed.xml')) {
        return new Response('feed broken', { status: 500 });
      }
      return new Response(
        '<html><h2><a href="/fallback">Fallback Item</a></h2></html>',
        { status: 200 }
      );
    });
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitorWithRss],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.results[0].written).toBe(true);
    expect(result.results[0].itemsCount).toBe(1);
    // Error from RSS failure should be recorded
    expect(result.results[0].errors.length).toBeGreaterThan(0);
    expect(result.results[0].errors[0]).toMatch(/RSS fetch failed/);
  });

  it('still writes a snapshot with 0 items when both RSS and homepage fail', async () => {
    // fetchCompetitorContent absorbs fetch errors and returns
    // {items: [], errors: [...]} — the snapshot writer persists that
    // empty result so we have a record of the attempt. The errors are
    // in the KV blob for inspection.
    const { db } = makeDb({ id: 'snap-4', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response('down', { status: 500 })
    );
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitorWithRss],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.completedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.results[0].written).toBe(true);
    expect(result.results[0].itemsCount).toBe(0);
    expect(result.results[0].errors.length).toBe(2); // RSS + homepage
    expect(result.results[0].errors[0]).toMatch(/RSS fetch failed/);
    expect(result.results[0].errors[1]).toMatch(/Homepage fetch failed/);
  });

  it('processes multiple competitors independently — one failure does not block the other', async () => {
    const { db } = makeDb({ id: 'snap-m', attempt_count: 1 }, 1);
    const { kv } = makeKv();
    let callCount = 0;
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      callCount += 1;
      if (callCount <= 1) {
        return new Response(
          '<html><h2><a href="/a">Item A</a></h2></html>',
          { status: 200 }
        );
      }
      return new Response('down', { status: 500 });
    });
    const env = { DB: db, KV: kv } as unknown as Env;
    const compA: CompetitorConfig = {
      ...testCompetitor,
      slug: 'comp-a',
      name: 'Comp A',
    };
    const compB: CompetitorConfig = {
      ...testCompetitor,
      slug: 'comp-b',
      name: 'Comp B',
    };
    const result = await runCompetitorSnapshots(env, {
      competitors: [compA, compB],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.totalCompetitors).toBe(2);
    // Both write a snapshot — fetchCompetitorContent absorbs per-source
    // fetch errors and returns {items: [], errors: [...]} instead of
    // throwing, so the snapshot writer still persists (with 0 items).
    // compA has items, compB has 0 items but is still "completed."
    expect(result.completedCount).toBe(2);
    expect(result.failedCount).toBe(0);

    const resA = result.results.find((r) => r.slug === 'comp-a')!;
    const resB = result.results.find((r) => r.slug === 'comp-b')!;
    expect(resA.written).toBe(true);
    expect(resA.itemsCount).toBe(1);
    expect(resA.errors).toEqual([]);
    expect(resB.written).toBe(true);
    expect(resB.itemsCount).toBe(0);
    expect(resB.errors.length).toBeGreaterThan(0);
    expect(resB.errors[0]).toMatch(/Homepage fetch failed/);
  });

  it('returns reclaimed when complete*() reports zero changes', async () => {
    const { db } = makeDb({ id: 'snap-r', attempt_count: 1 }, 0);
    const { kv } = makeKv();
    globalThis.fetch = vi.fn<typeof fetch>(async () =>
      new Response('<html><h2>Title</h2></html>', { status: 200 })
    );
    const env = { DB: db, KV: kv } as unknown as Env;
    const result = await runCompetitorSnapshots(env, {
      competitors: [testCompetitor],
      windowStart: '2026-04-13T00:00:00Z',
    });
    expect(result.results[0].written).toBe(false);
    expect(result.results[0].reason).toMatch(/reclaimed/);
  });
});
