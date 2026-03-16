import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pressReleaseCollector } from './pressrelease';
import type { SourceConfig } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfig(overrides: Record<string, string> = {}): SourceConfig {
  return {
    id: 'pr-test',
    sourceType: 'rss',
    name: 'Press Releases',
    config: { ...overrides },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
  };
}

const PR_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>PR Newswire — Financial Services</title>
    <link>https://www.prnewswire.com</link>
    <item>
      <title>Intuit Launches AI-Powered Accounting Automation</title>
      <link>https://www.prnewswire.com/news/intuit-ai-accounting</link>
      <pubDate>Mon, 10 Mar 2025 12:00:00 GMT</pubDate>
      <description>Intuit today announced a new AI-powered accounting automation feature for QuickBooks.</description>
    </item>
    <item>
      <title>Major Bank Reports Q4 Earnings</title>
      <link>https://www.prnewswire.com/news/bank-q4-earnings</link>
      <pubDate>Mon, 10 Mar 2025 10:00:00 GMT</pubDate>
      <description>A major bank reported its fourth quarter earnings today, beating analyst expectations.</description>
    </item>
    <item>
      <title>New Tax AI Platform Revolutionizes Audit Process</title>
      <link>https://www.prnewswire.com/news/tax-ai-audit</link>
      <pubDate>Mon, 10 Mar 2025 08:00:00 GMT</pubDate>
      <description>A new AI-driven platform for tax preparation and audit automation.</description>
    </item>
  </channel>
</rss>`;

describe('pressReleaseCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should export a collector with a collect method', () => {
    expect(pressReleaseCollector).toBeDefined();
    expect(typeof pressReleaseCollector.collect).toBe('function');
  });

  it('should parse RSS feed and filter by keywords', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    // Should include accounting/AI press releases
    expect(articles.length).toBeGreaterThanOrEqual(2);
    const titles = articles.map((a) => a.title);
    expect(titles).toContain('Intuit Launches AI-Powered Accounting Automation');
    expect(titles).toContain('New Tax AI Platform Revolutionizes Audit Process');
  });

  it('should filter out irrelevant press releases', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    const titles = articles.map((a) => a.title);
    // The bank earnings article should be filtered out (no accounting/AI keywords)
    expect(titles).not.toContain('Major Bank Reports Q4 Earnings');
  });

  it('should set sourceType to rss', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    for (const article of articles) {
      expect(article.sourceType).toBe('rss');
    }
  });

  it('should use default feeds when no URL is configured', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    await pressReleaseCollector.collect(makeConfig());

    // Should have fetched from default feeds (2 feeds)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should return empty array on HTTP error', async () => {
    mockFetch.mockResolvedValue(
      new Response('Server Error', { status: 500 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    expect(articles).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    expect(articles).toEqual([]);
  });

  it('should deduplicate articles across feeds', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({
        feeds: 'https://feed1.com/rss,https://feed2.com/rss',
      })
    );

    const urls = articles.map((a) => a.url);
    const uniqueUrls = new Set(urls);
    expect(urls.length).toBe(uniqueUrls.size);
  });

  it('should return empty array on empty response', async () => {
    mockFetch.mockResolvedValue(
      new Response('', { status: 200 })
    );

    const articles = await pressReleaseCollector.collect(
      makeConfig({ url: 'https://www.prnewswire.com/rss/test.rss' })
    );

    expect(articles).toEqual([]);
  });

  it('should handle custom feed URLs from config', async () => {
    mockFetch.mockResolvedValue(
      new Response(PR_RSS_FEED, { status: 200 })
    );

    await pressReleaseCollector.collect(
      makeConfig({
        feeds: 'https://custom-feed.com/rss',
      })
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toBe('https://custom-feed.com/rss');
  });
});
