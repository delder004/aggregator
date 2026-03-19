import { describe, it, expect } from 'vitest';
import { diversifyFeatured, diversifyFeed } from './diversity';
import type { Article, SourceType } from '../types';

function makeArticle(overrides: Partial<Article> = {}): Article {
  return {
    id: 'art-1',
    url: 'https://example.com/article',
    title: 'Test Article',
    headline: null,
    sourceType: 'rss' as SourceType,
    sourceName: 'Test Source',
    author: null,
    publishedAt: '2026-03-15T12:00:00Z',
    fetchedAt: '2026-03-15T12:05:00Z',
    contentSnippet: null,
    imageUrl: null,
    relevanceScore: 80,
    qualityScore: 70,
    aiSummary: 'Test summary',
    tags: ['automation'],
    isPublished: true,
    socialScore: null,
    commentCount: null,
    companyMentions: [],
    transcript: null,
    transcriptSummary: null,
    ...overrides,
  };
}

describe('diversifyFeatured', () => {
  it('returns all articles when from different sources', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'Source A' }),
      makeArticle({ id: '2', sourceName: 'Source B' }),
      makeArticle({ id: '3', sourceName: 'Source C' }),
    ];
    const result = diversifyFeatured(articles, 1, 6);
    expect(result.map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('limits articles from same source', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'Source A' }),
      makeArticle({ id: '2', sourceName: 'Source A' }),
      makeArticle({ id: '3', sourceName: 'Source B' }),
    ];
    const result = diversifyFeatured(articles, 1, 6);
    expect(result.map((a) => a.id)).toEqual(['1', '3']);
  });

  it('respects total limit', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'A' }),
      makeArticle({ id: '2', sourceName: 'B' }),
      makeArticle({ id: '3', sourceName: 'C' }),
    ];
    const result = diversifyFeatured(articles, 3, 2);
    expect(result).toHaveLength(2);
  });

  it('works with empty array', () => {
    expect(diversifyFeatured([], 2, 6)).toEqual([]);
  });
});

describe('diversifyFeed', () => {
  it('returns same array when all articles from different sources', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'Source A' }),
      makeArticle({ id: '2', sourceName: 'Source B' }),
      makeArticle({ id: '3', sourceName: 'Source C' }),
    ];
    const result = diversifyFeed(articles);
    expect(result.map((a) => a.id)).toEqual(['1', '2', '3']);
  });

  it('defers excess articles from same source to end', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'A' }),
      makeArticle({ id: '2', sourceName: 'A' }),
      makeArticle({ id: '3', sourceName: 'A' }),
      makeArticle({ id: '4', sourceName: 'B' }),
    ];
    // maxPerSource=2 (default), so first 2 from A pass, 3rd deferred
    const result = diversifyFeed(articles);
    expect(result.map((a) => a.id)).toEqual(['1', '2', '4', '3']);
  });

  it('works with empty array', () => {
    expect(diversifyFeed([])).toEqual([]);
  });

  it('handles all articles from same source', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'Only' }),
      makeArticle({ id: '2', sourceName: 'Only' }),
      makeArticle({ id: '3', sourceName: 'Only' }),
      makeArticle({ id: '4', sourceName: 'Only' }),
      makeArticle({ id: '5', sourceName: 'Only' }),
    ];
    // maxPerSource=2 within windowSize=10: first 2 pass, rest deferred
    const result = diversifyFeed(articles);
    expect(result.map((a) => a.id)).toEqual(['1', '2', '3', '4', '5']);
    // First 2 are in main section, rest at end (all still present)
    expect(result).toHaveLength(5);
  });

  it('preserves order among included articles', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'A' }),
      makeArticle({ id: '2', sourceName: 'B' }),
      makeArticle({ id: '3', sourceName: 'A' }),
      makeArticle({ id: '4', sourceName: 'B' }),
      makeArticle({ id: '5', sourceName: 'A' }),
      makeArticle({ id: '6', sourceName: 'C' }),
    ];
    // maxPerSource=2: A gets 1,3 (5 deferred), B gets 2,4, C gets 6
    const result = diversifyFeed(articles);
    expect(result.map((a) => a.id)).toEqual(['1', '2', '3', '4', '6', '5']);
  });

  it('respects custom maxPerSource', () => {
    const articles = [
      makeArticle({ id: '1', sourceName: 'A' }),
      makeArticle({ id: '2', sourceName: 'A' }),
      makeArticle({ id: '3', sourceName: 'B' }),
    ];
    const result = diversifyFeed(articles, 1);
    // Only 1 from A allowed in window, second deferred
    expect(result.map((a) => a.id)).toEqual(['1', '3', '2']);
  });
});
