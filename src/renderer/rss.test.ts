import { describe, it, expect } from 'vitest';
import { generateRssFeed } from './rss';
import type { Article } from '../types';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'test-id-1',
    url: 'https://example.com/article-1',
    title: 'Test Article',
    sourceType: 'rss',
    sourceName: 'Accounting Today',
    author: 'Jane Doe',
    publishedAt: '2026-03-15T10:00:00Z',
    fetchedAt: '2026-03-15T10:30:00Z',
    contentSnippet: 'This is a test snippet.',
    imageUrl: 'https://example.com/image.jpg',
    relevanceScore: 85,
    aiSummary: 'AI is transforming accounting workflows.',
    tags: ['agentic-ai', 'automation'],
    isPublished: true,
    ...overrides,
  };
}

describe('generateRssFeed', () => {
  it('returns valid RSS 2.0 XML with channel metadata', () => {
    const xml = generateRssFeed([]);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>Agentic AI Accounting</title>');
    expect(xml).toContain('<link>https://agenticaiaccounting.com</link>');
    expect(xml).toContain(
      '<description>The latest on AI agents in accounting, bookkeeping, audit, and tax</description>'
    );
    expect(xml).toContain('<language>en-us</language>');
    expect(xml).toContain('<lastBuildDate>');
    expect(xml).toContain('<ttl>60</ttl>');
    expect(xml).toContain('</channel>');
    expect(xml).toContain('</rss>');
  });

  it('includes atom:link self-reference', () => {
    const xml = generateRssFeed([]);
    expect(xml).toContain('xmlns:atom="http://www.w3.org/2005/Atom"');
    expect(xml).toContain(
      '<atom:link href="https://agenticaiaccounting.com/feed.xml" rel="self" type="application/rss+xml" />'
    );
  });

  it('renders article items with correct elements', () => {
    const article = makeArticle();
    const xml = generateRssFeed([article]);

    expect(xml).toContain('<item>');
    expect(xml).toContain('<title>Test Article</title>');
    expect(xml).toContain('<link>https://example.com/article-1</link>');
    expect(xml).toContain('<guid isPermaLink="true">https://example.com/article-1</guid>');
    expect(xml).toContain(
      '<description>AI is transforming accounting workflows.</description>'
    );
    expect(xml).toContain('<pubDate>');
    expect(xml).toContain('<source url="https://agenticaiaccounting.com">Accounting Today</source>');
    expect(xml).toContain('<author>Jane Doe</author>');
    expect(xml).toContain('<category>agentic-ai</category>');
    expect(xml).toContain('<category>automation</category>');
    expect(xml).toContain('</item>');
  });

  it('uses contentSnippet as description when aiSummary is null', () => {
    const article = makeArticle({ aiSummary: null });
    const xml = generateRssFeed([article]);

    expect(xml).toContain('<description>This is a test snippet.</description>');
  });

  it('renders empty description when both aiSummary and contentSnippet are null', () => {
    const article = makeArticle({ aiSummary: null, contentSnippet: null });
    const xml = generateRssFeed([article]);

    expect(xml).toContain('<description></description>');
  });

  it('omits author tag when author is null', () => {
    const article = makeArticle({ author: null });
    const xml = generateRssFeed([article]);

    expect(xml).not.toContain('<author>');
  });

  it('escapes XML special characters', () => {
    const article = makeArticle({
      title: 'AI & Accounting: <The Future> of "Tax"',
      aiSummary: 'O\'Brien says AI & ML are < revolutionary > for "audit"',
      sourceName: 'Test & Source',
      author: 'O\'Brien & Associates',
    });
    const xml = generateRssFeed([article]);

    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).toContain('&quot;');
    expect(xml).toContain('&apos;');
    // Should NOT contain unescaped special chars inside element content
    expect(xml).not.toMatch(/<title>[^<]*[&][^a]/); // no raw & in title
  });

  it('sorts articles by publishedAt descending (newest first)', () => {
    const older = makeArticle({
      id: 'old',
      url: 'https://example.com/old',
      title: 'Old Article',
      publishedAt: '2026-03-10T10:00:00Z',
    });
    const newer = makeArticle({
      id: 'new',
      url: 'https://example.com/new',
      title: 'New Article',
      publishedAt: '2026-03-15T10:00:00Z',
    });
    const xml = generateRssFeed([older, newer]);

    const newIdx = xml.indexOf('New Article');
    const oldIdx = xml.indexOf('Old Article');
    expect(newIdx).toBeLessThan(oldIdx);
  });

  it('renders multiple category tags for articles with multiple tags', () => {
    const article = makeArticle({
      tags: ['audit', 'tax', 'automation', 'big-4'],
    });
    const xml = generateRssFeed([article]);

    expect(xml).toContain('<category>audit</category>');
    expect(xml).toContain('<category>tax</category>');
    expect(xml).toContain('<category>automation</category>');
    expect(xml).toContain('<category>big-4</category>');
  });

  it('handles articles with empty tags array', () => {
    const article = makeArticle({ tags: [] });
    const xml = generateRssFeed([article]);

    expect(xml).toContain('<item>');
    expect(xml).not.toContain('<category>');
  });

  it('handles an empty articles array', () => {
    const xml = generateRssFeed([]);

    expect(xml).toContain('<channel>');
    expect(xml).toContain('</channel>');
    expect(xml).not.toContain('<item>');
  });

  it('generates valid RFC 822 date in pubDate', () => {
    const article = makeArticle({ publishedAt: '2026-03-15T14:30:00Z' });
    const xml = generateRssFeed([article]);

    // RFC 822 format: "Sun, 15 Mar 2026 14:30:00 GMT"
    const pubDateMatch = xml.match(/<pubDate>(.+?)<\/pubDate>/);
    expect(pubDateMatch).not.toBeNull();
    const dateStr = pubDateMatch![1];
    // Verify it parses back to a valid date
    const parsed = new Date(dateStr);
    expect(parsed.getTime()).not.toBeNaN();
    expect(dateStr).toContain('GMT');
  });

  it('does not mutate the input articles array', () => {
    const articles = [
      makeArticle({ publishedAt: '2026-03-15T10:00:00Z', url: 'https://example.com/1' }),
      makeArticle({ publishedAt: '2026-03-10T10:00:00Z', url: 'https://example.com/2' }),
    ];
    const originalOrder = articles.map((a) => a.url);

    generateRssFeed(articles);

    expect(articles.map((a) => a.url)).toEqual(originalOrder);
  });

  it('escapes URLs containing special characters', () => {
    const article = makeArticle({
      url: 'https://example.com/search?q=AI&topic=accounting',
    });
    const xml = generateRssFeed([article]);

    expect(xml).toContain(
      '<link>https://example.com/search?q=AI&amp;topic=accounting</link>'
    );
    expect(xml).toContain(
      '<guid isPermaLink="true">https://example.com/search?q=AI&amp;topic=accounting</guid>'
    );
  });
});
