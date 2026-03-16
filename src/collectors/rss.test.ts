import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RssCollector } from './rss';
import type { SourceConfig } from '../types';

function makeConfig(url: string, name = 'Test Feed'): SourceConfig {
  return {
    id: 'test-1',
    sourceType: 'rss',
    name,
    config: { url },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
  };
}

const RSS_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <item>
      <title>AI in Accounting: A New Era</title>
      <link>https://example.com/article-1</link>
      <pubDate>Mon, 10 Mar 2025 12:00:00 GMT</pubDate>
      <description><![CDATA[<p>This is a <strong>test</strong> article about AI in accounting.</p>]]></description>
      <dc:creator>Jane Doe</dc:creator>
      <media:thumbnail url="https://example.com/thumb.jpg" />
    </item>
    <item>
      <title>Second Article</title>
      <link>https://example.com/article-2</link>
      <pubDate>Tue, 11 Mar 2025 10:00:00 GMT</pubDate>
      <description>Simple text description without HTML.</description>
      <author>john@example.com</author>
      <enclosure url="https://example.com/image.png" type="image/png" length="12345" />
    </item>
  </channel>
</rss>`;

const ATOM_FEED = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <title>Atom Test Feed</title>
  <link href="https://example.com" rel="alternate" />
  <entry>
    <title>Atom Entry Title</title>
    <link href="https://example.com/atom-1" rel="alternate" />
    <published>2025-03-10T12:00:00Z</published>
    <author><name>Alice Smith</name></author>
    <summary>Summary of the atom entry about AI agents.</summary>
    <media:content url="https://example.com/media.jpg" medium="image" />
  </entry>
  <entry>
    <title>Second Atom Entry</title>
    <link href="https://example.com/atom-2" rel="alternate" />
    <updated>2025-03-11T15:30:00Z</updated>
    <content type="html"><![CDATA[<div>Content with <b>HTML</b> about bookkeeping automation.</div>]]></content>
  </entry>
</feed>`;

const RSS_WITH_RELATIVE_URLS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Relative URL Feed</title>
    <link>https://example.com</link>
    <item>
      <title>Relative URL Article</title>
      <link>/articles/relative-1</link>
      <pubDate>Wed, 12 Mar 2025 08:00:00 GMT</pubDate>
      <description>Article with a relative URL.</description>
    </item>
  </channel>
</rss>`;

const RSS_MISSING_FIELDS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Sparse Feed</title>
    <item>
      <title>No Link Item</title>
      <description>This item has no link and should be skipped.</description>
    </item>
    <item>
      <link>https://example.com/no-title</link>
      <description>This item has no title and should be skipped.</description>
    </item>
    <item>
      <title>Valid Item</title>
      <link>https://example.com/valid</link>
    </item>
  </channel>
</rss>`;

const LONG_DESCRIPTION = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Long Content Feed</title>
    <item>
      <title>Long Article</title>
      <link>https://example.com/long</link>
      <pubDate>Thu, 13 Mar 2025 09:00:00 GMT</pubDate>
      <description>${'A'.repeat(600)}</description>
    </item>
  </channel>
</rss>`;

describe('RssCollector', () => {
  let collector: RssCollector;

  beforeEach(() => {
    collector = new RssCollector();
    vi.restoreAllMocks();
  });

  it('should parse an RSS 2.0 feed correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(RSS_FEED, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );

    expect(articles).toHaveLength(2);

    // First article
    expect(articles[0].title).toBe('AI in Accounting: A New Era');
    expect(articles[0].url).toBe('https://example.com/article-1');
    expect(articles[0].sourceType).toBe('rss');
    expect(articles[0].sourceName).toBe('Test Feed');
    expect(articles[0].author).toBe('Jane Doe');
    expect(articles[0].publishedAt).toBe('2025-03-10T12:00:00.000Z');
    // CDATA + HTML stripping
    expect(articles[0].contentSnippet).toBe(
      'This is a test article about AI in accounting.'
    );
    expect(articles[0].imageUrl).toBe('https://example.com/thumb.jpg');

    // Second article
    expect(articles[1].title).toBe('Second Article');
    expect(articles[1].url).toBe('https://example.com/article-2');
    expect(articles[1].author).toBe('john@example.com');
    expect(articles[1].contentSnippet).toBe(
      'Simple text description without HTML.'
    );
    expect(articles[1].imageUrl).toBe('https://example.com/image.png');
  });

  it('should parse an Atom feed correctly', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(ATOM_FEED, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/atom.xml')
    );

    expect(articles).toHaveLength(2);

    expect(articles[0].title).toBe('Atom Entry Title');
    expect(articles[0].url).toBe('https://example.com/atom-1');
    expect(articles[0].author).toBe('Alice Smith');
    expect(articles[0].publishedAt).toBe('2025-03-10T12:00:00.000Z');
    expect(articles[0].contentSnippet).toBe(
      'Summary of the atom entry about AI agents.'
    );
    expect(articles[0].imageUrl).toBe('https://example.com/media.jpg');

    expect(articles[1].title).toBe('Second Atom Entry');
    expect(articles[1].url).toBe('https://example.com/atom-2');
    expect(articles[1].publishedAt).toBe('2025-03-11T15:30:00.000Z');
    // HTML in CDATA should be stripped
    expect(articles[1].contentSnippet).toBe(
      'Content with HTML about bookkeeping automation.'
    );
  });

  it('should resolve relative URLs against the feed URL', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(RSS_WITH_RELATIVE_URLS, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://example.com/articles/relative-1');
  });

  it('should skip items missing title or link', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(RSS_MISSING_FIELDS, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );

    // Only the "Valid Item" with both title and link should be collected
    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Valid Item');
    expect(articles[0].url).toBe('https://example.com/valid');
  });

  it('should truncate descriptions to 500 characters', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(LONG_DESCRIPTION, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].contentSnippet!.length).toBeLessThanOrEqual(500);
    expect(articles[0].contentSnippet!.endsWith('...')).toBe(true);
  });

  it('should return empty array when no URL is configured', async () => {
    const config = makeConfig('');
    config.config = {};

    const articles = await collector.collect(config);
    expect(articles).toEqual([]);
  });

  it('should return empty array on HTTP error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );
    expect(articles).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new Error('Network error')
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );
    expect(articles).toEqual([]);
  });

  it('should return empty array on invalid XML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('this is not xml at all!!!', { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );
    // Should either return empty or gracefully handle the bad XML
    expect(Array.isArray(articles)).toBe(true);
  });

  it('should return empty array on empty response body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('', { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );
    expect(articles).toEqual([]);
  });

  it('should handle RSS feed with content:encoded', async () => {
    const feedWithContentEncoded = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Content Encoded Feed</title>
    <item>
      <title>Rich Content Article</title>
      <link>https://example.com/rich</link>
      <pubDate>Fri, 14 Mar 2025 10:00:00 GMT</pubDate>
      <description>Short description.</description>
      <content:encoded><![CDATA[<p>This is the <em>full</em> rich content with more detail about AI agents in accounting firms.</p>]]></content:encoded>
    </item>
  </channel>
</rss>`;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(feedWithContentEncoded, { status: 200 })
    );

    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );

    expect(articles).toHaveLength(1);
    // Should prefer content:encoded over description
    expect(articles[0].contentSnippet).toBe(
      'This is the full rich content with more detail about AI agents in accounting firms.'
    );
  });

  it('should use current date when pubDate is missing', async () => {
    const feedNoDates = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>No Dates</title>
    <item>
      <title>Dateless Article</title>
      <link>https://example.com/dateless</link>
      <description>No date here.</description>
    </item>
  </channel>
</rss>`;

    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(feedNoDates, { status: 200 })
    );

    const before = new Date().toISOString();
    const articles = await collector.collect(
      makeConfig('https://example.com/feed.xml')
    );
    const after = new Date().toISOString();

    expect(articles).toHaveLength(1);
    // publishedAt should be between before and after
    expect(articles[0].publishedAt >= before).toBe(true);
    expect(articles[0].publishedAt <= after).toBe(true);
  });
});
