import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
} from 'vitest';
import type { SourceConfig, CollectedArticle, Collector } from '../types';
import { substackCollector } from './substack';

// --- Mock data ---

const MOCK_SUBSTACK_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AI Accounting Weekly</title>
    <link>https://aiaccounting.substack.com</link>
    <description>Weekly insights on AI in accounting</description>
    <item>
      <title>How AI Agents Are Transforming Tax Season</title>
      <link>https://aiaccounting.substack.com/p/ai-agents-tax-season</link>
      <pubDate>Mon, 10 Mar 2026 12:00:00 GMT</pubDate>
      <dc:creator>Jane Smith</dc:creator>
      <description>A brief look at how AI agents are changing the tax preparation landscape.</description>
      <content:encoded><![CDATA[<div class="body markup"><p>A brief look at how AI agents are changing the tax preparation landscape.</p><p>The 2026 tax season is unlike any before it. Accounting firms across the country are deploying AI agents that can handle routine tax preparations, freeing up CPAs to focus on complex advisory work. In this article, we explore the top five AI tools that are making waves in the profession, from automated document extraction to intelligent review systems that catch errors humans might miss. The implications for the industry are profound, as firms that adopt these technologies early are seeing significant improvements in both efficiency and accuracy.</p><h2>The Rise of Autonomous Tax Preparation</h2><p>Several major firms have begun piloting fully autonomous tax preparation systems powered by large language models. These systems can ingest client documents, extract relevant financial data, apply current tax law, and generate draft returns with minimal human oversight.</p></div>]]></content:encoded>
      <enclosure url="https://substackcdn.com/image/fetch/w_1200/tax-agents.jpg" type="image/jpeg" length="50000"/>
    </item>
    <item>
      <title>The Future of Audit: Agentic AI in Assurance Services</title>
      <link>https://aiaccounting.substack.com/p/future-audit-agentic-ai</link>
      <pubDate>Mon, 03 Mar 2026 12:00:00 GMT</pubDate>
      <dc:creator>John Doe</dc:creator>
      <description>Exploring agentic AI applications in modern audit workflows.</description>
      <content:encoded><![CDATA[<p>Exploring agentic AI applications in modern audit workflows. The audit profession is on the cusp of a major transformation as agentic AI systems become capable of performing substantive testing, analytical reviews, and even client communications autonomously.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

const MOCK_EMPTY_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Empty Newsletter</title>
    <link>https://empty.substack.com</link>
    <description>Nothing here</description>
  </channel>
</rss>`;

const MOCK_SHORT_CONTENT_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Short Content Newsletter</title>
    <link>https://short.substack.com</link>
    <item>
      <title>Short Post</title>
      <link>https://short.substack.com/p/short-post</link>
      <pubDate>Fri, 14 Mar 2026 10:00:00 GMT</pubDate>
      <dc:creator>Bob</dc:creator>
      <content:encoded><![CDATA[<p>Just a brief note.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

function makeConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    id: 'substack-test',
    sourceType: 'substack',
    name: 'AI Accounting Weekly',
    config: { url: 'https://aiaccounting.substack.com/feed' },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
    ...overrides,
  };
}

// --- Tests ---

describe('substackCollector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('exports a collector implementing the Collector interface', () => {
    expect(substackCollector).toBeDefined();
    expect(typeof substackCollector.collect).toBe('function');

    // Verify it satisfies Collector structurally
    const collector: Collector = substackCollector;
    expect(collector).toBe(substackCollector);
  });

  it('collects articles from a Substack RSS feed with sourceType "substack"', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(MOCK_SUBSTACK_RSS, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    );

    const articles = await substackCollector.collect(makeConfig());

    expect(articles).toHaveLength(2);

    // Every article should have sourceType 'substack'
    for (const article of articles) {
      expect(article.sourceType).toBe('substack');
    }

    // Check first article details
    const first = articles[0];
    expect(first.title).toBe('How AI Agents Are Transforming Tax Season');
    expect(first.url).toBe('https://aiaccounting.substack.com/p/ai-agents-tax-season');
    expect(first.author).toBe('Jane Smith');
    expect(first.publishedAt).toBe('2026-03-10T12:00:00.000Z');
    expect(first.imageUrl).toBe('https://substackcdn.com/image/fetch/w_1200/tax-agents.jpg');

    // Check second article
    const second = articles[1];
    expect(second.title).toBe('The Future of Audit: Agentic AI in Assurance Services');
    expect(second.author).toBe('John Doe');

    fetchSpy.mockRestore();
  });

  it('extracts extended content snippets up to 1000 chars', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(MOCK_SUBSTACK_RSS, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    );

    const articles = await substackCollector.collect(makeConfig());

    // The first article has long content:encoded — snippet should be > 500 chars
    // (rssCollector truncates to 500, but substack extends to 1000)
    const first = articles[0];
    expect(first.contentSnippet).toBeDefined();
    expect(first.contentSnippet!.length).toBeGreaterThan(500);
    expect(first.contentSnippet!.length).toBeLessThanOrEqual(1000);

    fetchSpy.mockRestore();
  });

  it('truncates content snippets to 1000 chars with ellipsis', async () => {
    // Create a feed with very long content (>1000 chars)
    const longContent = 'A'.repeat(2000);
    const longFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Long Content</title>
    <item>
      <title>Long Post</title>
      <link>https://long.substack.com/p/long-post</link>
      <pubDate>Fri, 14 Mar 2026 10:00:00 GMT</pubDate>
      <content:encoded><![CDATA[<p>${longContent}</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(longFeed, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    );

    const articles = await substackCollector.collect(
      makeConfig({ config: { url: 'https://long.substack.com/feed' } })
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].contentSnippet!.length).toBe(1000);
    expect(articles[0].contentSnippet!.endsWith('...')).toBe(true);

    fetchSpy.mockRestore();
  });

  it('keeps short content snippets without truncation', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(MOCK_SHORT_CONTENT_RSS, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    );

    const articles = await substackCollector.collect(
      makeConfig({ config: { url: 'https://short.substack.com/feed' } })
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].contentSnippet).toBe('Just a brief note.');
    expect(articles[0].sourceType).toBe('substack');

    fetchSpy.mockRestore();
  });

  it('returns empty array when no URL is configured', async () => {
    const articles = await substackCollector.collect(
      makeConfig({ config: {} })
    );
    expect(articles).toEqual([]);
  });

  it('returns empty array on network error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network error');
    });

    const articles = await substackCollector.collect(makeConfig());
    expect(articles).toEqual([]);

    fetchSpy.mockRestore();
  });

  it('returns empty array on HTTP error', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response('Not Found', { status: 404 })
    );

    const articles = await substackCollector.collect(makeConfig());
    expect(articles).toEqual([]);

    fetchSpy.mockRestore();
  });

  it('returns empty array for an empty feed', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(MOCK_EMPTY_FEED, {
        status: 200,
        headers: { 'Content-Type': 'application/rss+xml' },
      })
    );

    const articles = await substackCollector.collect(makeConfig());
    expect(articles).toEqual([]);

    fetchSpy.mockRestore();
  });

  it('gracefully handles failed extended snippet fetch', async () => {
    // First call (rssCollector) succeeds, second call (extended snippets) fails
    let callCount = 0;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) {
        return new Response(MOCK_SUBSTACK_RSS, {
          status: 200,
          headers: { 'Content-Type': 'application/rss+xml' },
        });
      }
      throw new Error('Second fetch failed');
    });

    const articles = await substackCollector.collect(makeConfig());

    // Should still return articles even though extended snippet fetch failed
    expect(articles.length).toBeGreaterThan(0);
    for (const article of articles) {
      expect(article.sourceType).toBe('substack');
    }

    fetchSpy.mockRestore();
  });
});
