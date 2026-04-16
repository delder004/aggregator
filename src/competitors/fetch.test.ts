import { describe, it, expect } from 'vitest';
import { extractHeadlineItems, parseRssItems } from './fetch';

describe('parseRssItems', () => {
  it('extracts title + link from RSS 2.0 items', () => {
    const xml = `<?xml version="1.0"?>
      <rss><channel>
        <item>
          <title>AI in Accounting</title>
          <link>https://example.com/ai-accounting</link>
        </item>
        <item>
          <title>Agentic Finance</title>
          <link>https://example.com/agentic</link>
        </item>
      </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items).toEqual([
      { title: 'AI in Accounting', url: 'https://example.com/ai-accounting' },
      { title: 'Agentic Finance', url: 'https://example.com/agentic' },
    ]);
  });

  it('handles CDATA-wrapped titles', () => {
    const xml = `<rss><channel>
      <item>
        <title><![CDATA[Special & Characters]]></title>
        <link>https://example.com/x</link>
      </item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items[0].title).toBe('Special & Characters');
  });

  it('decodes XML entities in titles', () => {
    const xml = `<rss><channel>
      <item><title>A &amp; B &lt; C</title><link>https://x.com</link></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items[0].title).toBe('A & B < C');
  });

  it('extracts title + link from Atom entries', () => {
    const xml = `<?xml version="1.0"?>
      <feed xmlns="http://www.w3.org/2005/Atom">
        <entry>
          <title>Atom Title</title>
          <link href="https://example.com/atom" rel="alternate"/>
        </entry>
      </feed>`;
    const items = parseRssItems(xml);
    expect(items).toEqual([
      { title: 'Atom Title', url: 'https://example.com/atom' },
    ]);
  });

  it('prefers RSS items when both formats are present', () => {
    const xml = `<rss><channel>
      <item><title>RSS Title</title><link>https://x.com/rss</link></item>
    </channel></rss>
    <feed><entry><title>Atom Title</title>
      <link href="https://x.com/atom" rel="alternate"/>
    </entry></feed>`;
    const items = parseRssItems(xml);
    // Should only find the RSS item since we check Atom only when RSS is empty
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('RSS Title');
  });

  it('returns items with null URL when link is missing', () => {
    const xml = `<rss><channel>
      <item><title>No Link</title></item>
    </channel></rss>`;
    const items = parseRssItems(xml);
    expect(items[0]).toEqual({ title: 'No Link', url: null });
  });

  it('returns empty array for non-feed XML', () => {
    expect(parseRssItems('<html><body>Not a feed</body></html>')).toEqual([]);
  });
});

describe('extractHeadlineItems', () => {
  const baseUrl = 'https://example.com';

  it('extracts headings with inner links', () => {
    const html = `<h2><a href="/article/1">Article Title</a></h2>`;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items).toEqual([
      { title: 'Article Title', url: 'https://example.com/article/1' },
    ]);
  });

  it('extracts headings wrapped in outer <a> tags', () => {
    const html = `<a href="/post/2"><h3>Wrapped Title</h3></a>`;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items).toEqual([
      { title: 'Wrapped Title', url: 'https://example.com/post/2' },
    ]);
  });

  it('extracts headings with no link (null url)', () => {
    const html = `<h1>Standalone Title</h1>`;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items).toEqual([{ title: 'Standalone Title', url: null }]);
  });

  it('strips inner HTML tags from heading text', () => {
    const html = `<h2><a href="/x"><strong>Bold</strong> Title</a></h2>`;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items[0].title).toBe('Bold Title');
  });

  it('resolves relative URLs to absolute', () => {
    const html = `<h2><a href="/foo">Relative Link</a></h2>`;
    const items = extractHeadlineItems(html, 'https://other.com/page');
    expect(items[0].url).toBe('https://other.com/foo');
  });

  it('deduplicates by lowercase title', () => {
    const html = `
      <h2><a href="/a">Same Title</a></h2>
      <h2><a href="/b">same title</a></h2>
    `;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items.length).toBe(1);
  });

  it('filters out very short titles (< 5 chars)', () => {
    const html = `<h2><a href="/x">Hi</a></h2><h2>Valid Title Here</h2>`;
    const items = extractHeadlineItems(html, baseUrl);
    expect(items.length).toBe(1);
    expect(items[0].title).toBe('Valid Title Here');
  });

  it('ignores javascript: and anchor-only hrefs', () => {
    const html = `
      <h2><a href="javascript:void(0)">JS Link</a></h2>
      <h2><a href="#section">Anchor Link Title</a></h2>
    `;
    const items = extractHeadlineItems(html, baseUrl);
    for (const item of items) {
      expect(item.url).toBe(null);
    }
  });

  it('returns empty array for HTML with no headings', () => {
    const html = `<div><p>No headings here</p></div>`;
    expect(extractHeadlineItems(html, baseUrl)).toEqual([]);
  });
});
