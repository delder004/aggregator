import { describe, it, expect, vi, beforeEach } from 'vitest';
import { hackerNewsCollector } from './hackernews';
import type { SourceConfig } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeConfig(query: string): SourceConfig {
  return {
    id: 'hn-test',
    sourceType: 'hn',
    name: 'Hacker News',
    config: { query },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
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
      hitsPerPage: 50,
    }),
  };
}

describe('hackerNewsCollector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return collected articles from HN API', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '123',
          title: 'AI in Accounting Revolution',
          url: 'https://example.com/ai-accounting',
          author: 'testuser',
          created_at: '2025-03-15T10:00:00.000Z',
          story_text: null,
          points: 42,
          num_comments: 10,
          _tags: ['story'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://example.com/ai-accounting');
    expect(articles[0].title).toBe('AI in Accounting Revolution');
    expect(articles[0].sourceType).toBe('hn');
    expect(articles[0].sourceName).toBe('Hacker News');
    expect(articles[0].author).toBe('testuser');
    expect(articles[0].publishedAt).toBe('2025-03-15T10:00:00.000Z');
    expect(articles[0].imageUrl).toBeNull();
  });

  it('should skip Ask HN posts', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '100',
          title: 'Ask HN: Best AI tools for accounting?',
          url: null,
          author: 'user1',
          created_at: '2025-03-15T09:00:00.000Z',
          story_text: 'Looking for recommendations...',
          points: 20,
          num_comments: 15,
          _tags: ['story', 'ask_hn'],
        },
        {
          objectID: '101',
          title: 'Real Article About AI Accounting',
          url: 'https://example.com/real-article',
          author: 'user2',
          created_at: '2025-03-15T09:30:00.000Z',
          story_text: null,
          points: 30,
          num_comments: 5,
          _tags: ['story'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Real Article About AI Accounting');
  });

  it('should skip posts with no URL (self-posts)', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '200',
          title: 'My thoughts on AI in finance',
          url: null,
          author: 'user3',
          created_at: '2025-03-15T08:00:00.000Z',
          story_text: 'Some long text...',
          points: 5,
          num_comments: 2,
          _tags: ['story'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI finance')
    );

    expect(articles).toHaveLength(0);
  });

  it('should skip comment-only posts', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '300',
          title: null,
          url: null,
          author: 'commenter',
          created_at: '2025-03-15T07:00:00.000Z',
          story_text: 'A comment',
          points: 1,
          num_comments: 0,
          _tags: ['comment'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(0);
  });

  it('should deduplicate results across multiple queries', async () => {
    const sharedHit = {
      objectID: '400',
      title: 'Shared Article',
      url: 'https://example.com/shared',
      author: 'author1',
      created_at: '2025-03-15T06:00:00.000Z',
      story_text: null,
      points: 50,
      num_comments: 20,
      _tags: ['story'],
    };

    // First query returns the shared hit
    mockFetch.mockResolvedValueOnce(makeHNResponse([sharedHit]));
    // Second query also returns the same hit
    mockFetch.mockResolvedValueOnce(makeHNResponse([sharedHit]));

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting,AI audit')
    );

    // Should only appear once despite being in both results
    expect(articles).toHaveLength(1);
    expect(articles[0].url).toBe('https://example.com/shared');
  });

  it('should handle multiple comma-separated queries', async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeHNResponse([
          {
            objectID: '500',
            title: 'Article from query 1',
            url: 'https://example.com/q1',
            author: 'a1',
            created_at: '2025-03-15T05:00:00.000Z',
            story_text: null,
            points: 10,
            num_comments: 2,
            _tags: ['story'],
          },
        ])
      )
      .mockResolvedValueOnce(
        makeHNResponse([
          {
            objectID: '501',
            title: 'Article from query 2',
            url: 'https://example.com/q2',
            author: 'a2',
            created_at: '2025-03-15T04:00:00.000Z',
            story_text: null,
            points: 15,
            num_comments: 3,
            _tags: ['story'],
          },
        ])
      );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting,AI audit')
    );

    expect(articles).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should return empty array on empty query', async () => {
    const articles = await hackerNewsCollector.collect(makeConfig(''));

    expect(articles).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return empty array when API fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(0);
  });

  it('should return empty array when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(0);
  });

  it('should truncate story_text to 500 characters', async () => {
    const longText = 'A'.repeat(600);

    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '600',
          title: 'Long story text article',
          url: 'https://example.com/long',
          author: 'author',
          created_at: '2025-03-15T03:00:00.000Z',
          story_text: longText,
          points: 10,
          num_comments: 1,
          _tags: ['story'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].contentSnippet).not.toBeNull();
    expect(articles[0].contentSnippet!.length).toBe(500);
    expect(articles[0].contentSnippet!.endsWith('...')).toBe(true);
  });

  it('should pass correct query parameters to Algolia API', async () => {
    mockFetch.mockResolvedValueOnce(makeHNResponse([]));

    await hackerNewsCollector.collect(makeConfig('AI accounting'));

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('hn.algolia.com/api/v1/search');
    expect(calledUrl).toContain('query=AI+accounting');
    expect(calledUrl).toContain('tags=story');
    expect(calledUrl).toContain('numericFilters=created_at_i');
    expect(calledUrl).toContain('hitsPerPage=50');
  });

  it('should handle "Ask HN -" variant in title', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '700',
          title: 'Ask HN \u2013 What AI tools do accountants use?',
          url: null,
          author: 'curious',
          created_at: '2025-03-15T02:00:00.000Z',
          story_text: 'Wondering what tools are popular',
          points: 8,
          num_comments: 12,
          _tags: ['story', 'ask_hn'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(0);
  });

  it('should deduplicate URLs with trailing slash differences', async () => {
    mockFetch.mockResolvedValueOnce(
      makeHNResponse([
        {
          objectID: '800',
          title: 'Article A',
          url: 'https://example.com/article',
          author: 'a',
          created_at: '2025-03-15T01:00:00.000Z',
          story_text: null,
          points: 10,
          num_comments: 1,
          _tags: ['story'],
        },
        {
          objectID: '801',
          title: 'Article A (duplicate)',
          url: 'https://example.com/article/',
          author: 'b',
          created_at: '2025-03-15T01:30:00.000Z',
          story_text: null,
          points: 5,
          num_comments: 0,
          _tags: ['story'],
        },
      ])
    );

    const articles = await hackerNewsCollector.collect(
      makeConfig('AI accounting')
    );

    expect(articles).toHaveLength(1);
    expect(articles[0].title).toBe('Article A');
  });
});
