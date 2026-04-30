import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchSerperResults,
  findOurRank,
  parseTotalResults,
  resolveRankingsWindow,
  runRankingsSweep,
} from './rankings';
import type { Env } from '../types';

describe('parseTotalResults', () => {
  it('parses "About 1,230,000 results"', () => {
    expect(parseTotalResults('About 1,230,000 results')).toBe(1230000);
  });
  it('parses plain digit strings', () => {
    expect(parseTotalResults('1230000')).toBe(1230000);
  });
  it('returns null for undefined', () => {
    expect(parseTotalResults(undefined)).toBe(null);
  });
  it('returns null for empty strings', () => {
    expect(parseTotalResults('')).toBe(null);
  });
  it('returns null for strings with no digits', () => {
    expect(parseTotalResults('no results')).toBe(null);
  });
});

describe('findOurRank', () => {
  const serp = {
    features: [],
    totalResults: null,
    organic: [
      { position: 1, link: 'https://other.com/a' },
      { position: 2, link: 'https://www.agenticaiccounting.com/article/foo' },
      { position: 3, link: 'https://agenticaiccounting.com/' },
    ],
  };

  it('matches exact hostname', () => {
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 1, link: 'https://agenticaiccounting.com/' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(1);
    expect(result.url).toBe('https://agenticaiccounting.com/');
  });

  it('matches subdomain (www.)', () => {
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 5, link: 'https://www.agenticaiccounting.com/x' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(5);
  });

  it('does NOT match a non-suffix imposter domain', () => {
    // notagenticaiccounting.com would be a false match for a naive endsWith check
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 1, link: 'https://notagenticaiccounting.com/x' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(null);
    expect(result.url).toBe(null);
  });

  it('returns the first matching position when multiple results match', () => {
    const result = findOurRank(serp, 'agenticaiccounting.com');
    // The second organic row (position 2, www.) matches first
    expect(result.rank).toBe(2);
    expect(result.url).toBe('https://www.agenticaiccounting.com/article/foo');
  });

  it('returns null rank but non-null URL when position field is missing (matched-but-no-position)', () => {
    // This case counts as "ranked" in the sweep summary (we appeared in
    // results), not "unranked" (which means we were absent entirely).
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { link: 'https://agenticaiccounting.com/' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(null);
    expect(result.url).toBe('https://agenticaiccounting.com/');
  });

  it('skips results with invalid URLs', () => {
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 1, link: 'not a url' },
        { position: 2, link: 'https://agenticaiccounting.com/' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(2);
  });

  it('returns null when our site is not in results', () => {
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 1, link: 'https://competitor.com/' },
        { position: 2, link: 'https://another.com/' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(null);
    expect(result.url).toBe(null);
  });

  it('is case-insensitive on hostname', () => {
    const result = findOurRank(
      { features: [], totalResults: null, organic: [
        { position: 1, link: 'https://AgenticAiccounting.COM/' },
      ] },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(1);
  });

  it('defensively skips null/undefined organic rows (sparse arrays)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sparse: any = [
      { position: 1, link: 'https://other.com/' },
      undefined,
      null,
      { position: 4, link: 'https://agenticaiccounting.com/' },
    ];
    const result = findOurRank(
      { features: [], totalResults: null, organic: sparse },
      'agenticaiccounting.com'
    );
    expect(result.rank).toBe(4);
  });
});

describe('resolveRankingsWindow', () => {
  it('defaults to the current weekly window start', () => {
    // Just assert it returns a parseable ISO string; exact value depends on
    // the real clock. The window.test.ts suite already verifies getWeeklyWindow.
    const result = resolveRankingsWindow();
    expect(Number.isNaN(Date.parse(result))).toBe(false);
    expect(result.endsWith('T00:00:00.000Z')).toBe(true);
  });

  it('normalizes any override to the Monday of its weekly bucket', () => {
    // Wednesday 2026-04-08 → Monday 2026-04-06
    expect(resolveRankingsWindow('2026-04-08T00:00:00Z')).toBe(
      '2026-04-06T00:00:00.000Z'
    );
    // Sunday 2026-04-12 23:59 → still the same Monday
    expect(resolveRankingsWindow('2026-04-12T23:59:59Z')).toBe(
      '2026-04-06T00:00:00.000Z'
    );
    // Exactly on Monday → itself
    expect(resolveRankingsWindow('2026-04-06T00:00:00Z')).toBe(
      '2026-04-06T00:00:00.000Z'
    );
  });

  it('normalizes a non-UTC offset to the correct Monday bucket', () => {
    // 2026-04-05T14:00:00-10:00 = 2026-04-06T00:00:00Z = Monday → Monday
    const result = resolveRankingsWindow('2026-04-05T14:00:00-10:00');
    expect(result).toBe('2026-04-06T00:00:00.000Z');
  });

  it('rejects timezone-less ISO overrides', () => {
    expect(() => resolveRankingsWindow('2026-04-06T00:00:00')).toThrow(
      /strict ISO 8601/
    );
  });

  it('rejects impossible calendar dates', () => {
    expect(() => resolveRankingsWindow('2026-02-31T00:00:00Z')).toThrow(
      /strict ISO 8601/
    );
  });
});

describe('fetchSerperResults', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('POSTs to Serper with X-API-KEY header and JSON body', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(JSON.stringify({ organic: [] }), { status: 200 })
    );
    globalThis.fetch = fetchMock;
    await fetchSerperResults('test-key', 'agentic ai accounting');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://google.serper.dev/search');
    const headers = init.headers as Record<string, string>;
    expect(headers['X-API-KEY']).toBe('test-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(init.body as string);
    expect(body.q).toBe('agentic ai accounting');
    expect(body.num).toBe(10);
    expect(body.gl).toBe('us');
    expect(body.hl).toBe('en');
  });

  it('parses organic results and totalResults', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            organic: [
              { position: 1, link: 'https://a.com', title: 'A' },
              { position: 2, link: 'https://b.com', title: 'B' },
            ],
            searchInformation: { totalResults: 'About 5,000 results' },
          }),
          { status: 200 }
        )
    );
    const result = await fetchSerperResults('test-key', 'q');
    expect(result.organic.length).toBe(2);
    expect(result.totalResults).toBe(5000);
  });

  it('extracts SERP features when present', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            organic: [],
            knowledgeGraph: { title: 'foo' },
            peopleAlsoAsk: [{ question: 'q1' }],
            topStories: [{ title: 's1' }],
            videos: [{ link: 'v1' }],
            relatedSearches: [{ query: 'r1' }],
            answerBox: { answer: 'x' },
          }),
          { status: 200 }
        )
    );
    const result = await fetchSerperResults('test-key', 'q');
    expect(new Set(result.features)).toEqual(
      new Set([
        'knowledge_graph',
        'answer_box',
        'people_also_ask',
        'top_stories',
        'videos',
        'related_searches',
      ])
    );
  });

  it('returns empty features for a bare response', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({ organic: [] }), { status: 200 })
    );
    const result = await fetchSerperResults('test-key', 'q');
    expect(result.features).toEqual([]);
  });

  it('throws with upstream body on non-2xx', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response('bad key', { status: 401 })
    );
    await expect(fetchSerperResults('bad', 'q')).rejects.toThrow(
      /Serper API 401/
    );
  });

  it('handles missing organic array without throwing', async () => {
    globalThis.fetch = vi.fn<typeof fetch>(
      async () => new Response(JSON.stringify({}), { status: 200 })
    );
    const result = await fetchSerperResults('k', 'q');
    expect(result.organic).toEqual([]);
    expect(result.features).toEqual([]);
    expect(result.totalResults).toBe(null);
  });
});

describe('runRankingsSweep', () => {
  let originalFetch: typeof fetch;
  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function makeDb() {
    const run = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const bind = vi.fn().mockReturnThis();
    const prepare = vi.fn().mockReturnValue({ bind, run });
    return { db: { prepare } as unknown as D1Database, prepare, run };
  }

  function serperResponse(
    ourRank: number | null,
    ourUrl: string | null
  ): Response {
    // Build a dense 10-entry organic array so arbitrary rank positions
    // work without sparse holes.
    const organic: Array<{ position: number; link: string }> = [];
    for (let i = 1; i <= 10; i++) {
      organic.push({ position: i, link: `https://filler${i}.example/` });
    }
    if (ourRank !== null && ourUrl !== null && ourRank >= 1 && ourRank <= 10) {
      organic[ourRank - 1] = { position: ourRank, link: ourUrl };
    }
    return new Response(
      JSON.stringify({ organic, searchInformation: { totalResults: '1000' } }),
      { status: 200 }
    );
  }

  it('throws if SERPER_API_KEY is missing', async () => {
    const env = { DB: {} as D1Database } as unknown as Env;
    await expect(runRankingsSweep(env)).rejects.toThrow(/SERPER_API_KEY/);
  });

  it('throws if keyword list is empty', async () => {
    const env = {
      DB: {} as D1Database,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    await expect(runRankingsSweep(env, { keywords: [] })).rejects.toThrow(
      /at least one keyword/
    );
  });

  it('throws if keyword list exceeds the budget', async () => {
    const env = {
      DB: {} as D1Database,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    const tooMany = Array.from({ length: 100 }, (_, i) => `k${i}`);
    await expect(
      runRankingsSweep(env, { keywords: tooMany })
    ).rejects.toThrow(/budget/);
  });

  it('records ranked, unranked, and failed results in one sweep', async () => {
    const { db, prepare } = makeDb();
    let callCount = 0;
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      callCount += 1;
      if (callCount === 1) {
        // k1: ranked at position 3
        return serperResponse(3, 'https://agenticaiccounting.com/article/x');
      }
      if (callCount === 2) {
        // k2: not ranked (our site not in results)
        return serperResponse(null, null);
      }
      // k3: API error
      return new Response('quota exceeded', { status: 429 });
    });

    const env = {
      DB: db,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    const result = await runRankingsSweep(env, {
      keywords: ['k1', 'k2', 'k3'],
      windowStart: '2026-04-06T00:00:00Z',
    });

    expect(result.totalKeywords).toBe(3);
    expect(result.rankedCount).toBe(1);
    expect(result.unrankedCount).toBe(1);
    expect(result.failedCount).toBe(1);
    expect(result.windowStart).toBe('2026-04-06T00:00:00.000Z');

    // k1 ranked
    const k1 = result.rankings.find((r) => r.keyword === 'k1')!;
    expect(k1.rank).toBe(3);
    expect(k1.urlRanked).toBe('https://agenticaiccounting.com/article/x');
    expect(k1.failed).toBe(false);

    // k2 unranked but not failed
    const k2 = result.rankings.find((r) => r.keyword === 'k2')!;
    expect(k2.rank).toBe(null);
    expect(k2.urlRanked).toBe(null);
    expect(k2.failed).toBe(false);

    // k3 failed
    const k3 = result.rankings.find((r) => r.keyword === 'k3')!;
    expect(k3.rank).toBe(null);
    expect(k3.failed).toBe(true);

    // All three keywords should have written to D1 (the failed one records
    // a null-rank row as a history entry).
    expect(prepare).toHaveBeenCalledTimes(3);
  });

  it('continues the sweep when one keyword errors', async () => {
    const { db } = makeDb();
    let callCount = 0;
    globalThis.fetch = vi.fn<typeof fetch>(async () => {
      callCount += 1;
      if (callCount === 2) {
        return new Response('err', { status: 500 });
      }
      return serperResponse(5, 'https://agenticaiccounting.com/');
    });
    const env = {
      DB: db,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    const result = await runRankingsSweep(env, {
      keywords: ['k1', 'k2', 'k3'],
      windowStart: '2026-04-06T00:00:00Z',
    });
    expect(result.failedCount).toBe(1);
    expect(result.rankedCount).toBe(2);
  });

  it('respects an explicit hostname override', async () => {
    const { db } = makeDb();
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            organic: [
              { position: 1, link: 'https://example.com/only-this-matches' },
            ],
          }),
          { status: 200 }
        )
    );
    const env = {
      DB: db,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    const result = await runRankingsSweep(env, {
      keywords: ['k1'],
      windowStart: '2026-04-06T00:00:00Z',
      hostname: 'example.com',
    });
    expect(result.rankings[0].rank).toBe(1);
  });

  it('counts "matched but no position" as ranked, not unranked', async () => {
    const { db } = makeDb();
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            organic: [
              // Serper returns our URL but omits the position field entirely
              { link: 'https://agenticaiccounting.com/article/x' },
            ],
          }),
          { status: 200 }
        )
    );
    const env = {
      DB: db,
      SERPER_API_KEY: 'key',
    } as unknown as Env;
    const result = await runRankingsSweep(env, {
      keywords: ['k1'],
      windowStart: '2026-04-06T00:00:00Z',
    });
    // We appeared in results → counted as ranked, not unranked
    expect(result.rankedCount).toBe(1);
    expect(result.unrankedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    // But the rank number itself is null
    expect(result.rankings[0].rank).toBe(null);
    expect(result.rankings[0].urlRanked).toBe(
      'https://agenticaiccounting.com/article/x'
    );
  });

  it('falls back to env.SITE_HOSTNAME when options.hostname is omitted', async () => {
    const { db } = makeDb();
    globalThis.fetch = vi.fn<typeof fetch>(
      async () =>
        new Response(
          JSON.stringify({
            organic: [{ position: 2, link: 'https://some-override.test/x' }],
          }),
          { status: 200 }
        )
    );
    const env = {
      DB: db,
      SERPER_API_KEY: 'key',
      SITE_HOSTNAME: 'some-override.test',
    } as unknown as Env;
    const result = await runRankingsSweep(env, {
      keywords: ['k1'],
      windowStart: '2026-04-06T00:00:00Z',
    });
    expect(result.hostname).toBe('some-override.test');
    expect(result.rankings[0].rank).toBe(2);
  });
});
