import { describe, it, expect, vi, beforeEach } from 'vitest';
import { companyBlogCollector } from './companyblog';
import type { SourceConfig } from '../types';

function makeConfig(
  company: string,
  url: string = 'https://blog.example.com/feed.xml'
): SourceConfig {
  return {
    id: 'blog-test',
    sourceType: 'rss',
    name: `${company} Blog Feed`,
    config: { url, company },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
  };
}

const BLOG_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Intuit Blog</title>
    <link>https://blog.intuit.com</link>
    <item>
      <title>Introducing AI-Powered Bookkeeping</title>
      <link>https://blog.intuit.com/ai-bookkeeping</link>
      <pubDate>Mon, 10 Mar 2025 12:00:00 GMT</pubDate>
      <description>Our new AI feature automates your bookkeeping.</description>
    </item>
    <item>
      <title>QuickBooks Update 2025</title>
      <link>https://blog.intuit.com/qb-update</link>
      <pubDate>Tue, 11 Mar 2025 10:00:00 GMT</pubDate>
      <description>Latest updates to QuickBooks Online.</description>
    </item>
  </channel>
</rss>`;

describe('companyBlogCollector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('should export a collector with a collect method', () => {
    expect(companyBlogCollector).toBeDefined();
    expect(typeof companyBlogCollector.collect).toBe('function');
  });

  it('should tag articles with the company name', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(BLOG_RSS, { status: 200 })
    );

    const articles = await companyBlogCollector.collect(makeConfig('Intuit'));

    expect(articles.length).toBe(2);
    for (const article of articles) {
      expect(article.sourceName).toBe('Intuit Blog');
      expect(article.sourceType).toBe('rss');
    }
  });

  it('should return articles from the RSS feed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(BLOG_RSS, { status: 200 })
    );

    const articles = await companyBlogCollector.collect(makeConfig('Intuit'));

    expect(articles[0].title).toBe('Introducing AI-Powered Bookkeeping');
    expect(articles[0].url).toBe('https://blog.intuit.com/ai-bookkeeping');
  });

  it('should return empty array when no company is configured', async () => {
    const config: SourceConfig = {
      id: 'blog-test',
      sourceType: 'rss',
      name: 'Unknown Blog',
      config: { url: 'https://blog.example.com/feed.xml' },
      isActive: true,
      lastFetchedAt: null,
      errorCount: 0,
    };

    const articles = await companyBlogCollector.collect(config);
    expect(articles).toEqual([]);
  });

  it('should return empty array when no URL is configured', async () => {
    const config: SourceConfig = {
      id: 'blog-test',
      sourceType: 'rss',
      name: 'Test Blog',
      config: { company: 'TestCo' },
      isActive: true,
      lastFetchedAt: null,
      errorCount: 0,
    };

    const articles = await companyBlogCollector.collect(config);
    expect(articles).toEqual([]);
  });

  it('should return empty array on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const articles = await companyBlogCollector.collect(makeConfig('Intuit'));
    expect(articles).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Network error')
    );

    const articles = await companyBlogCollector.collect(makeConfig('Intuit'));
    expect(articles).toEqual([]);
  });

  it('should work with different company names', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(BLOG_RSS, { status: 200 })
    );

    const articles = await companyBlogCollector.collect(makeConfig('Xero'));

    for (const article of articles) {
      expect(article.sourceName).toBe('Xero Blog');
    }
  });
});
