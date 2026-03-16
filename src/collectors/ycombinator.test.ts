import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ycombinatorCollector } from './ycombinator';
import type { SourceConfig } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfig(overrides: Record<string, string> = {}): SourceConfig {
  return {
    id: 'yc-test',
    sourceType: 'hn',
    name: 'Y Combinator',
    config: { ...overrides },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
  };
}

function makeYCCompaniesResponse(companies: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      companies,
      page: 1,
      totalPages: 1,
      count: companies.length,
    }),
  };
}

function makeHNResponse(hits: Array<Record<string, unknown>>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      hits,
      nbHits: hits.length,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20,
    }),
  };
}

describe('ycombinatorCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should export a collector with a collect method', () => {
    expect(ycombinatorCollector).toBeDefined();
    expect(typeof ycombinatorCollector.collect).toBe('function');
  });

  it('should fetch from YC companies API and HN search', async () => {
    // Mock YC companies API (3 default company queries)
    mockFetch.mockResolvedValueOnce(
      makeYCCompaniesResponse([
        {
          id: 1,
          name: 'TestAccounting',
          slug: 'testaccounting',
          url: 'https://www.ycombinator.com/companies/testaccounting',
          batch: 'W24',
          status: 'Active',
          industries: ['Fintech'],
          regions: [],
          locations: [],
          long_description: 'AI accounting platform',
          one_liner: 'AI-powered accounting for startups',
          team_size: 10,
          highlight_black: false,
          highlight_latinx: false,
          highlight_women: false,
          top_company: false,
          isHiring: false,
          nonprofit: false,
          demo_day_video_public: null,
          launch_hn: null,
          website: 'https://testaccounting.com',
        },
      ])
    );
    // Remaining company queries
    mockFetch.mockResolvedValueOnce(makeYCCompaniesResponse([]));
    mockFetch.mockResolvedValueOnce(makeYCCompaniesResponse([]));

    // Mock HN search (4 default queries)
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '111',
          title: 'Launch HN: AI Bookkeeping Tool',
          url: 'https://example.com/launch-hn',
          author: 'founder',
          created_at: '2025-03-15T10:00:00.000Z',
          story_text: 'We built an AI tool for bookkeeping.',
          points: 50,
          num_comments: 20,
          _tags: ['story'],
        },
      ])
    );
    mockFetch.mockResolvedValueOnce(makeHNResponse([]));
    mockFetch.mockResolvedValueOnce(makeHNResponse([]));
    mockFetch.mockResolvedValueOnce(makeHNResponse([]));

    const articles = await ycombinatorCollector.collect(makeConfig());

    expect(articles.length).toBeGreaterThanOrEqual(2);
    const titles = articles.map((a) => a.title);
    expect(titles.some((t) => t.includes('TestAccounting'))).toBe(true);
    expect(titles.some((t) => t.includes('Launch HN: AI Bookkeeping Tool'))).toBe(true);
  });

  it('should set sourceType to hn', async () => {
    mockFetch.mockResolvedValueOnce(
      makeYCCompaniesResponse([
        {
          id: 2,
          name: 'FinBot',
          slug: 'finbot',
          url: 'https://www.ycombinator.com/companies/finbot',
          batch: 'S23',
          status: 'Active',
          industries: ['AI'],
          regions: [],
          locations: [],
          long_description: 'Financial automation',
          one_liner: 'Automated finance',
          team_size: 5,
          highlight_black: false,
          highlight_latinx: false,
          highlight_women: false,
          top_company: false,
          isHiring: false,
          nonprofit: false,
          demo_day_video_public: null,
          launch_hn: null,
          website: 'https://finbot.ai',
        },
      ])
    );
    // Fill remaining mock responses
    mockFetch.mockResolvedValue(makeYCCompaniesResponse([]));

    const articles = await ycombinatorCollector.collect(makeConfig());

    for (const article of articles) {
      expect(article.sourceType).toBe('hn');
    }
  });

  it('should skip inactive companies', async () => {
    mockFetch.mockResolvedValueOnce(
      makeYCCompaniesResponse([
        {
          id: 3,
          name: 'DeadStartup',
          slug: 'deadstartup',
          url: 'https://www.ycombinator.com/companies/deadstartup',
          batch: 'W20',
          status: 'Inactive',
          industries: ['Fintech'],
          regions: [],
          locations: [],
          long_description: 'Was an accounting tool',
          one_liner: 'Dead startup',
          team_size: 0,
          highlight_black: false,
          highlight_latinx: false,
          highlight_women: false,
          top_company: false,
          isHiring: false,
          nonprofit: false,
          demo_day_video_public: null,
          launch_hn: null,
          website: 'https://deadstartup.com',
        },
      ])
    );
    mockFetch.mockResolvedValue(makeYCCompaniesResponse([]));

    const articles = await ycombinatorCollector.collect(makeConfig());

    const titles = articles.map((a) => a.title);
    expect(titles.some((t) => t.includes('DeadStartup'))).toBe(false);
  });

  it('should return empty array when all APIs fail', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const articles = await ycombinatorCollector.collect(makeConfig());

    expect(articles).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const articles = await ycombinatorCollector.collect(makeConfig());

    expect(articles).toEqual([]);
  });

  it('should deduplicate articles by URL', async () => {
    const sameCompany = {
      id: 4,
      name: 'DupeCompany',
      slug: 'dupecompany',
      url: 'https://www.ycombinator.com/companies/dupecompany',
      batch: 'W24',
      status: 'Active',
      industries: ['Fintech'],
      regions: [],
      locations: [],
      long_description: 'Duplicate test',
      one_liner: 'Test',
      team_size: 5,
      highlight_black: false,
      highlight_latinx: false,
      highlight_women: false,
      top_company: false,
      isHiring: false,
      nonprofit: false,
      demo_day_video_public: null,
      launch_hn: null,
      website: 'https://dupecompany.com',
    };

    // Two queries returning same company
    mockFetch.mockResolvedValueOnce(makeYCCompaniesResponse([sameCompany]));
    mockFetch.mockResolvedValueOnce(makeYCCompaniesResponse([sameCompany]));
    mockFetch.mockResolvedValue(makeYCCompaniesResponse([]));

    const articles = await ycombinatorCollector.collect(makeConfig());

    const dupeUrls = articles.filter((a) => a.url === 'https://dupecompany.com');
    expect(dupeUrls.length).toBeLessThanOrEqual(1);
  });

  it('should accept custom query config', async () => {
    mockFetch.mockResolvedValue(makeYCCompaniesResponse([]));

    await ycombinatorCollector.collect(
      makeConfig({
        companyQueries: 'custom accounting query',
        hnQueries: 'custom hn query',
      })
    );

    // Should have called fetch for 1 company query + 1 HN query
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
