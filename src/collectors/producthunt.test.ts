import { describe, it, expect, vi, beforeEach } from 'vitest';
import { productHuntCollector } from './producthunt';
import type { SourceConfig } from '../types';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfig(overrides: Record<string, string> = {}): SourceConfig {
  return {
    id: 'ph-test',
    sourceType: 'rss',
    name: 'Product Hunt',
    config: { ...overrides },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
  };
}

const PH_RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Product Hunt — AI</title>
    <link>https://www.producthunt.com</link>
    <item>
      <title>AI Accounting Bot — Automate your bookkeeping with AI</title>
      <link>https://www.producthunt.com/posts/ai-accounting-bot</link>
      <pubDate>Mon, 10 Mar 2025 12:00:00 GMT</pubDate>
      <description>An AI-powered tool for automated bookkeeping and accounting tasks.</description>
    </item>
    <item>
      <title>Cool Design Tool — Make beautiful designs</title>
      <link>https://www.producthunt.com/posts/cool-design-tool</link>
      <pubDate>Mon, 10 Mar 2025 10:00:00 GMT</pubDate>
      <description>A design tool for creating beautiful graphics.</description>
    </item>
    <item>
      <title>FinTech Dashboard — AI-powered financial analytics</title>
      <link>https://www.producthunt.com/posts/fintech-dashboard</link>
      <pubDate>Mon, 10 Mar 2025 08:00:00 GMT</pubDate>
      <description>Real-time fintech analytics for accounting firms.</description>
    </item>
  </channel>
</rss>`;

describe('productHuntCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should export a collector with a collect method', () => {
    expect(productHuntCollector).toBeDefined();
    expect(typeof productHuntCollector.collect).toBe('function');
  });

  it('should parse RSS feed and filter by relevance keywords', async () => {
    mockFetch.mockResolvedValue(
      new Response(PH_RSS_FEED, { status: 200 })
    );

    const articles = await productHuntCollector.collect(
      makeConfig({ url: 'https://www.producthunt.com/topics/ai/rss' })
    );

    // Should include accounting/fintech articles but not the design tool
    expect(articles.length).toBeGreaterThanOrEqual(2);
    const titles = articles.map((a) => a.title);
    expect(titles).toContain('AI Accounting Bot — Automate your bookkeeping with AI');
    expect(titles).toContain('FinTech Dashboard — AI-powered financial analytics');
    expect(titles).not.toContain('Cool Design Tool — Make beautiful designs');
  });

  it('should set sourceType to rss', async () => {
    mockFetch.mockResolvedValue(
      new Response(PH_RSS_FEED, { status: 200 })
    );

    const articles = await productHuntCollector.collect(
      makeConfig({ url: 'https://www.producthunt.com/topics/ai/rss' })
    );

    for (const article of articles) {
      expect(article.sourceType).toBe('rss');
    }
  });

  it('should use default feeds when no URL is configured', async () => {
    mockFetch.mockResolvedValue(
      new Response(PH_RSS_FEED, { status: 200 })
    );

    await productHuntCollector.collect(makeConfig());

    // Should have fetched from default topic feeds (3 feeds)
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should return empty array on HTTP error', async () => {
    mockFetch.mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const articles = await productHuntCollector.collect(
      makeConfig({ url: 'https://www.producthunt.com/bad-url' })
    );

    expect(articles).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const articles = await productHuntCollector.collect(
      makeConfig({ url: 'https://www.producthunt.com/topics/ai/rss' })
    );

    expect(articles).toEqual([]);
  });

  it('should deduplicate articles across feeds', async () => {
    mockFetch.mockResolvedValue(
      new Response(PH_RSS_FEED, { status: 200 })
    );

    const articles = await productHuntCollector.collect(
      makeConfig({
        feeds: 'https://feed1.com/rss,https://feed2.com/rss',
      })
    );

    // Both feeds return same content — should deduplicate
    const urls = articles.map((a) => a.url);
    const uniqueUrls = new Set(urls);
    expect(urls.length).toBe(uniqueUrls.size);
  });

  it('should return empty array on empty response', async () => {
    mockFetch.mockResolvedValue(
      new Response('', { status: 200 })
    );

    const articles = await productHuntCollector.collect(
      makeConfig({ url: 'https://www.producthunt.com/topics/ai/rss' })
    );

    expect(articles).toEqual([]);
  });
});
