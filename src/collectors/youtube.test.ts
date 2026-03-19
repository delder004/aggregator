import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createYouTubeCollector } from './youtube';
import type { SourceConfig } from '../types';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeSourceConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    id: 'yt-test',
    sourceType: 'youtube',
    name: 'Test YouTube Source',
    config: { query: 'AI accounting' },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
    ...overrides,
  };
}

function makeYouTubeResponse(items: unknown[] = []) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        items,
        pageInfo: { totalResults: items.length, resultsPerPage: 15 },
      }),
    text: () => Promise.resolve(''),
  };
}

function makeVideoItem(overrides: Record<string, unknown> = {}) {
  return {
    id: { kind: 'youtube#video', videoId: 'abc123' },
    snippet: {
      publishedAt: '2026-03-15T10:00:00Z',
      channelId: 'UCtest',
      title: 'AI in Accounting: A Deep Dive',
      description: 'This video covers the latest developments in AI for accounting firms.',
      thumbnails: {
        medium: { url: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg', width: 320, height: 180 },
        default: { url: 'https://i.ytimg.com/vi/abc123/default.jpg', width: 120, height: 90 },
      },
      channelTitle: 'Test Channel',
      liveBroadcastContent: 'none',
    },
    ...overrides,
  };
}

describe('YouTube Collector', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('should return empty array when no API key is configured', async () => {
    const collector = createYouTubeCollector({});
    const result = await collector.collect(makeSourceConfig());
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return empty array when no query or channelId is configured', async () => {
    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const config = makeSourceConfig({ config: {} });
    const result = await collector.collect(config);
    expect(result).toEqual([]);
  });

  it('should fetch and map video search results', async () => {
    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([makeVideoItem()]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      url: 'https://youtube.com/watch?v=abc123',
      title: 'AI in Accounting: A Deep Dive',
      sourceType: 'youtube',
      sourceName: 'Test YouTube Source',
      author: 'Test Channel',
      publishedAt: '2026-03-15T10:00:00Z',
      contentSnippet: 'This video covers the latest developments in AI for accounting firms.',
      imageUrl: 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
    });
  });

  it('should pass query parameter to the API', async () => {
    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    await collector.collect(makeSourceConfig({ config: { query: 'AI audit automation' } }));

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('q')).toBe('AI audit automation');
    expect(calledUrl.searchParams.get('type')).toBe('video');
    expect(calledUrl.searchParams.get('key')).toBe('test-key');
  });

  it('should pass channelId parameter to the API', async () => {
    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    await collector.collect(
      makeSourceConfig({ config: { channelId: 'UC00MExfC3vuP9680IUW0jLA' } })
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('channelId')).toBe('UC00MExfC3vuP9680IUW0jLA');
  });

  it('should support both query and channelId together', async () => {
    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    await collector.collect(
      makeSourceConfig({ config: { query: 'AI', channelId: 'UCtest' } })
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(calledUrl.searchParams.get('q')).toBe('AI');
    expect(calledUrl.searchParams.get('channelId')).toBe('UCtest');
  });

  it('should skip non-video results', async () => {
    const channelResult = {
      id: { kind: 'youtube#channel' },
      snippet: {
        publishedAt: '2026-03-15T10:00:00Z',
        channelId: 'UCtest',
        title: 'Some Channel',
        description: 'A channel',
        thumbnails: { medium: { url: 'https://example.com/thumb.jpg', width: 320, height: 180 } },
        channelTitle: 'Test',
        liveBroadcastContent: 'none',
      },
    };

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([channelResult, makeVideoItem()]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe('https://youtube.com/watch?v=abc123');
  });

  it('should skip live broadcasts', async () => {
    const liveItem = makeVideoItem();
    (liveItem.snippet as Record<string, unknown>).liveBroadcastContent = 'live';

    const upcomingItem = makeVideoItem();
    (upcomingItem.id as Record<string, unknown>).videoId = 'upcoming123';
    (upcomingItem.snippet as Record<string, unknown>).liveBroadcastContent = 'upcoming';

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([liveItem, upcomingItem]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(0);
  });

  it('should decode HTML entities in title and description', async () => {
    const item = makeVideoItem();
    (item.snippet as Record<string, unknown>).title = 'AI &amp; Accounting: What&#39;s Next?';
    (item.snippet as Record<string, unknown>).description =
      'Learn about AI &lt;agents&gt; in the &quot;real world&quot;';

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([item]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("AI & Accounting: What's Next?");
    expect(result[0].contentSnippet).toBe('Learn about AI <agents> in the "real world"');
  });

  it('should truncate long descriptions to 500 chars', async () => {
    const longDesc = 'A'.repeat(600);
    const item = makeVideoItem();
    (item.snippet as Record<string, unknown>).description = longDesc;

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([item]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    // Should be truncated — exact length depends on word boundary logic,
    // but must not exceed 500 + "..." length
    expect(result[0].contentSnippet!.length).toBeLessThanOrEqual(503);
  });

  it('should fall back to default thumbnail if medium is unavailable', async () => {
    const item = makeVideoItem();
    (item.snippet as Record<string, unknown>).thumbnails = {
      default: { url: 'https://i.ytimg.com/vi/abc123/default.jpg', width: 120, height: 90 },
    };

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([item]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].imageUrl).toBe('https://i.ytimg.com/vi/abc123/default.jpg');
  });

  it('should return empty array on API error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      text: () => Promise.resolve('{"error":{"code":403,"message":"Quota exceeded"}}'),
    });

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });

  it('should return empty array on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });

  it('should return empty array when API returns error in body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          error: { code: 400, message: 'Invalid request', errors: [] },
        }),
      text: () => Promise.resolve(''),
    });

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });

  it('should handle multiple video results', async () => {
    const items = [
      makeVideoItem(),
      {
        ...makeVideoItem(),
        id: { kind: 'youtube#video', videoId: 'def456' },
        snippet: {
          ...makeVideoItem().snippet,
          title: 'Second Video',
          channelTitle: 'Another Channel',
        },
      },
    ];

    mockFetch.mockResolvedValueOnce(makeYouTubeResponse(items));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(2);
    expect(result[0].url).toBe('https://youtube.com/watch?v=abc123');
    expect(result[1].url).toBe('https://youtube.com/watch?v=def456');
  });

  it('should set publishedAfter to filter last 7 days', async () => {
    mockFetch.mockResolvedValueOnce(makeYouTubeResponse([]));

    const collector = createYouTubeCollector({ YOUTUBE_API_KEY: 'test-key' });
    await collector.collect(makeSourceConfig());

    const calledUrl = new URL(mockFetch.mock.calls[0][0]);
    const publishedAfter = calledUrl.searchParams.get('publishedAfter');
    expect(publishedAfter).toBeTruthy();

    // Should be roughly 7 days ago (within a few seconds)
    const publishedDate = new Date(publishedAfter!);
    const expectedDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const diffMs = Math.abs(publishedDate.getTime() - expectedDate.getTime());
    expect(diffMs).toBeLessThan(5000); // within 5 seconds
  });
});
