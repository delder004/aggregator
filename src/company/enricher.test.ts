import { describe, it, expect } from 'vitest';
import {
  generateSlugs,
  extractRssLinkFromHtml,
  isGenericName,
} from './enricher';

describe('generateSlugs', () => {
  it('should generate condensed and hyphenated slugs', () => {
    const slugs = generateSlugs('Blue J');
    expect(slugs).toContain('bluej');
    expect(slugs).toContain('blue-j');
  });

  it('should handle single-word names', () => {
    const slugs = generateSlugs('Rillet');
    expect(slugs).toEqual(['rillet']);
  });

  it('should strip special characters', () => {
    const slugs = generateSlugs('Vic.ai');
    expect(slugs).toContain('vicai');
    expect(slugs).toContain('vic-ai');
  });

  it('should handle names with multiple spaces', () => {
    const slugs = generateSlugs('Black Ore AI');
    expect(slugs).toContain('blackoreai');
    expect(slugs).toContain('black-ore-ai');
  });
});

describe('extractRssLinkFromHtml', () => {
  it('should extract RSS feed URL from link tag', () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/rss+xml" href="/feed.xml" title="RSS Feed">
      </head></html>
    `;
    const result = extractRssLinkFromHtml(html, 'https://example.com');
    expect(result).toBe('https://example.com/feed.xml');
  });

  it('should extract Atom feed URL', () => {
    const html = `
      <html><head>
        <link rel="alternate" type="application/atom+xml" href="/atom.xml">
      </head></html>
    `;
    const result = extractRssLinkFromHtml(html, 'https://example.com');
    expect(result).toBe('https://example.com/atom.xml');
  });

  it('should handle absolute URLs in href', () => {
    const html = `
      <link rel="alternate" type="application/rss+xml" href="https://blog.example.com/feed">
    `;
    const result = extractRssLinkFromHtml(html, 'https://example.com');
    expect(result).toBe('https://blog.example.com/feed');
  });

  it('should return null when no RSS link is found', () => {
    const html = `
      <html><head>
        <link rel="stylesheet" href="/style.css">
      </head></html>
    `;
    const result = extractRssLinkFromHtml(html, 'https://example.com');
    expect(result).toBeNull();
  });

  it('should return null for empty HTML', () => {
    expect(extractRssLinkFromHtml('', 'https://example.com')).toBeNull();
  });

  it('should handle alternate with different attribute order', () => {
    const html = `
      <link type="application/rss+xml" rel="alternate" href="/blog/feed.xml">
    `;
    const result = extractRssLinkFromHtml(html, 'https://example.com');
    expect(result).toBe('https://example.com/blog/feed.xml');
  });
});

describe('isGenericName', () => {
  it('should reject very short names', () => {
    expect(isGenericName('AI')).toBe(true);
    expect(isGenericName('Go')).toBe(true);
    expect(isGenericName('X')).toBe(true);
  });

  it('should reject common English words', () => {
    expect(isGenericName('the')).toBe(true);
    expect(isGenericName('new')).toBe(true);
    expect(isGenericName('data')).toBe(true);
    expect(isGenericName('cloud')).toBe(true);
    expect(isGenericName('ai')).toBe(true);
  });

  it('should reject single words <= 3 chars', () => {
    expect(isGenericName('Zap')).toBe(true);
    expect(isGenericName('Run')).toBe(true);
  });

  it('should accept real company names', () => {
    expect(isGenericName('Rillet')).toBe(false);
    expect(isGenericName('Truewind')).toBe(false);
    expect(isGenericName('BlackLine')).toBe(false);
    expect(isGenericName('Vic.ai')).toBe(false);
    expect(isGenericName('Blue J')).toBe(false);
  });

  it('should accept longer multi-word names', () => {
    expect(isGenericName('Black Ore')).toBe(false);
    expect(isGenericName('Dual Entry')).toBe(false);
  });

  it('should accept 4-char single words', () => {
    expect(isGenericName('Xero')).toBe(false);
    expect(isGenericName('Ramp')).toBe(false);
    expect(isGenericName('Brex')).toBe(false);
  });
});
