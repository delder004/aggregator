import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from 'vitest';
import { fetchMock } from 'cloudflare:test';
import { createRedditCollector } from './reddit';
import type { SourceConfig } from '../types';

function makeSourceConfig(overrides: Partial<SourceConfig> = {}): SourceConfig {
  return {
    id: 'test-reddit-1',
    sourceType: 'reddit',
    name: 'r/accounting',
    config: {
      subreddit: 'accounting',
      query: '"AI" OR "automation"',
    },
    isActive: true,
    lastFetchedAt: null,
    errorCount: 0,
    ...overrides,
  };
}

function makeRedditListing(posts: Array<Record<string, unknown>>) {
  return {
    kind: 'Listing',
    data: {
      children: posts.map((p) => ({
        kind: 't3',
        data: {
          id: 'abc123',
          name: 't3_abc123',
          title: 'Test Post',
          selftext: '',
          url: 'https://example.com/article',
          permalink: '/r/accounting/comments/abc123/test_post/',
          author: 'testuser',
          created_utc: 1710000000,
          is_self: false,
          thumbnail: 'default',
          subreddit: 'accounting',
          num_comments: 5,
          score: 42,
          over_18: false,
          ...p,
        },
      })),
      after: null,
    },
  };
}

const oauthResponseBody = JSON.stringify({
  access_token: 'test-token-12345',
  expires_in: 3600,
  token_type: 'bearer',
});

describe('Reddit Collector', () => {
  beforeEach(() => {
    fetchMock.activate();
    fetchMock.disableNetConnect();
  });

  afterEach(() => {
    fetchMock.deactivate();
  });

  it('returns empty array when credentials are missing', async () => {
    const collector = createRedditCollector({});
    const result = await collector.collect(makeSourceConfig());
    expect(result).toEqual([]);
  });

  it('returns empty array when subreddit is missing from config', async () => {
    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
    });
    const config = makeSourceConfig({
      config: { query: '"AI"' },
    });
    const result = await collector.collect(config);
    expect(result).toEqual([]);
  });

  it('returns empty array when query is missing from config', async () => {
    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'id',
      REDDIT_CLIENT_SECRET: 'secret',
    });
    const config = makeSourceConfig({
      config: { subreddit: 'accounting' },
    });
    const result = await collector.collect(config);
    expect(result).toEqual([]);
  });

  it('fetches and maps a link post correctly', async () => {
    const listing = makeRedditListing([
      {
        id: 'post1',
        title: 'AI is transforming accounting',
        url: 'https://example.com/ai-accounting',
        permalink: '/r/accounting/comments/post1/ai_transforming/',
        author: 'accountant_ai',
        created_utc: 1710000000,
        is_self: false,
        thumbnail: 'https://example.com/thumb.jpg',
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('AI is transforming accounting');
    expect(result[0].url).toBe('https://example.com/ai-accounting');
    expect(result[0].sourceType).toBe('reddit');
    expect(result[0].sourceName).toBe('r/accounting');
    expect(result[0].author).toBe('u/accountant_ai');
    expect(result[0].imageUrl).toBe('https://example.com/thumb.jpg');
  });

  it('uses Reddit permalink for self posts', async () => {
    const listing = makeRedditListing([
      {
        id: 'selfpost1',
        title: 'My experience with AI bookkeeping',
        selftext:
          'I have been using an AI agent for my bookkeeping and it is great...',
        url: 'https://www.reddit.com/r/accounting/comments/selfpost1/my_experience/',
        permalink: '/r/accounting/comments/selfpost1/my_experience/',
        author: 'bookkeeper99',
        created_utc: 1710100000,
        is_self: true,
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].url).toBe(
      'https://www.reddit.com/r/accounting/comments/selfpost1/my_experience/'
    );
    expect(result[0].contentSnippet).toBe(
      'I have been using an AI agent for my bookkeeping and it is great...'
    );
  });

  it('filters out NSFW posts', async () => {
    const listing = makeRedditListing([
      {
        id: 'nsfw1',
        title: 'NSFW Post',
        over_18: true,
      },
      {
        id: 'safe1',
        title: 'Safe AI Post',
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Safe AI Post');
  });

  it('truncates selftext to 500 characters', async () => {
    const longText = 'A'.repeat(600);
    const listing = makeRedditListing([
      {
        id: 'long1',
        title: 'Long post',
        selftext: longText,
        is_self: true,
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].contentSnippet).toHaveLength(500);
  });

  it('returns empty array when OAuth fails', async () => {
    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(401, 'Unauthorized');

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'bad-id',
      REDDIT_CLIENT_SECRET: 'bad-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });

  it('returns empty array when search API fails', async () => {
    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(500, 'Internal Server Error');

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });

  it('converts created_utc to ISO 8601 publishedAt', async () => {
    const timestamp = 1710000000;
    const listing = makeRedditListing([
      {
        id: 'time1',
        title: 'Timestamp test',
        created_utc: timestamp,
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].publishedAt).toBe(
      new Date(timestamp * 1000).toISOString()
    );
  });

  it('filters out deleted and removed posts', async () => {
    const listing = makeRedditListing([
      {
        id: 'del1',
        title: '[deleted]',
        over_18: false,
      },
      {
        id: 'rem1',
        title: '[removed]',
        over_18: false,
      },
      {
        id: 'ok1',
        title: 'Valid post',
        over_18: false,
      },
    ]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Valid post');
  });

  it('handles empty listing response', async () => {
    const listing = makeRedditListing([]);

    fetchMock
      .get('https://www.reddit.com')
      .intercept({ path: '/api/v1/access_token', method: 'POST' })
      .reply(200, oauthResponseBody, {
        headers: { 'content-type': 'application/json' },
      });

    fetchMock
      .get('https://oauth.reddit.com')
      .intercept({
        path: (p: string) => p.startsWith('/r/accounting/search'),
      })
      .reply(200, JSON.stringify(listing), {
        headers: { 'content-type': 'application/json' },
      });

    const collector = createRedditCollector({
      REDDIT_CLIENT_ID: 'test-id',
      REDDIT_CLIENT_SECRET: 'test-secret',
    });
    const result = await collector.collect(makeSourceConfig());

    expect(result).toEqual([]);
  });
});
