import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Hacker News collector using the Algolia HN Search API.
 *
 * Queries hn.algolia.com/api/v1/search for stories matching the configured
 * query string, filtered to the last 24 hours. Deduplicates results by URL
 * across multiple queries. Skips Ask HN and comment-only posts.
 */

const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';

/** Shape of an Algolia HN search hit (fields we use). */
interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  created_at: string | null;
  story_text: string | null;
  points: number | null;
  num_comments: number | null;
  _tags?: string[];
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

/**
 * Build the numeric timestamp filter for "last 24 hours".
 * Algolia uses `created_at_i` (Unix epoch seconds) for numeric range filters.
 */
function last24hFilter(): string {
  const now = Math.floor(Date.now() / 1000);
  const oneDayAgo = now - 24 * 60 * 60;
  return `created_at_i>${oneDayAgo}`;
}

/**
 * Returns true if the hit should be skipped.
 * We skip:
 *   - Ask HN posts (no external URL, title starts with "Ask HN:")
 *   - Comment-only posts (tagged as "comment" without "story")
 *   - Posts with no title
 *   - Posts with no URL (self-posts with no external link)
 */
function shouldSkip(hit: HNHit): boolean {
  // No title — nothing useful to show
  if (!hit.title) {
    return true;
  }

  // Ask HN posts — these are community Q&A, not external articles
  if (hit.title.startsWith('Ask HN:') || hit.title.startsWith('Ask HN –')) {
    return true;
  }

  // Comment-only posts (tagged as "comment" but not "story")
  const tags = hit._tags ?? [];
  if (tags.includes('comment') && !tags.includes('story')) {
    return true;
  }

  // No external URL — self-posts without content aren't useful for an aggregator
  if (!hit.url) {
    return true;
  }

  return false;
}

/**
 * Truncate a string to maxLen characters, appending "..." if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

/**
 * Build the HN discussion URL for a story.
 */
function hnDiscussionUrl(objectID: string): string {
  return `https://news.ycombinator.com/item?id=${objectID}`;
}

/**
 * Fetch a single query from the Algolia HN search API.
 * Returns the parsed response or null on error.
 */
async function fetchQuery(query: string): Promise<HNSearchResponse | null> {
  const params = new URLSearchParams({
    query,
    tags: 'story',
    numericFilters: last24hFilter(),
    hitsPerPage: '50',
  });

  const url = `${HN_SEARCH_URL}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(
        `HN Algolia API returned ${response.status} for query "${query}"`
      );
      return null;
    }

    const data = (await response.json()) as HNSearchResponse;
    return data;
  } catch (err) {
    console.error(`Failed to fetch HN search for query "${query}":`, err);
    return null;
  }
}

/**
 * Map an HN hit to a CollectedArticle.
 * Uses the external URL as the article URL. Falls back to the HN discussion
 * URL only if we somehow get here without an external URL (shouldn't happen
 * after shouldSkip filtering).
 */
function hitToArticle(hit: HNHit, sourceName: string): CollectedArticle {
  const articleUrl = hit.url || hnDiscussionUrl(hit.objectID);

  // Use story_text as snippet if available (for Show HN etc.), truncated to 500 chars
  const snippet = hit.story_text ? truncate(hit.story_text, 500) : null;

  return {
    url: articleUrl,
    title: hit.title ?? 'Untitled',
    sourceType: 'hn',
    sourceName,
    author: hit.author ?? null,
    publishedAt: hit.created_at ?? new Date().toISOString(),
    contentSnippet: snippet,
    imageUrl: null, // HN doesn't provide thumbnails
  };
}

export const hackerNewsCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    try {
      // The config.config object contains a `query` field.
      // It may contain multiple queries separated by commas, or just one.
      const queryField = config.config['query'] ?? '';
      if (!queryField) {
        console.error('HN collector: no query configured');
        return [];
      }

      // Split on commas to support multiple queries in one source config
      const queries = queryField
        .split(',')
        .map((q) => q.trim())
        .filter((q) => q.length > 0);

      if (queries.length === 0) {
        console.error('HN collector: empty query after parsing');
        return [];
      }

      // Fetch all queries (Algolia rate limit is generous: 10K req/hr)
      const results = await Promise.all(queries.map(fetchQuery));

      // Deduplicate by URL across all query results
      const seenUrls = new Set<string>();
      const articles: CollectedArticle[] = [];

      for (const result of results) {
        if (!result) continue;

        for (const hit of result.hits) {
          if (shouldSkip(hit)) continue;

          const articleUrl = hit.url || hnDiscussionUrl(hit.objectID);

          // Normalize URL for dedup (strip trailing slash, lowercase hostname)
          const normalizedUrl = normalizeUrl(articleUrl);
          if (seenUrls.has(normalizedUrl)) continue;
          seenUrls.add(normalizedUrl);

          articles.push(hitToArticle(hit, config.name));
        }
      }

      console.log(
        `HN collector: fetched ${articles.length} unique articles from ${queries.length} queries`
      );

      return articles;
    } catch (err) {
      console.error('HN collector: unexpected error:', err);
      return [];
    }
  },
};

/**
 * Normalize a URL for deduplication purposes.
 * Lowercases the hostname and removes trailing slashes.
 */
function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hostname = parsed.hostname.toLowerCase();
    // Remove trailing slash from pathname (but keep "/" for root)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, just return the raw string lowercased
    return rawUrl.toLowerCase();
  }
}
