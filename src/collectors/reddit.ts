import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Reddit collector using OAuth app-only flow and the JSON search API.
 *
 * Usage:
 *   const collector = createRedditCollector(env);
 *   const articles = await collector.collect(sourceConfig);
 *
 * SourceConfig.config should contain:
 *   - subreddit: e.g. "accounting"
 *   - query: e.g. '"AI" OR "automation" OR "agentic"'
 */

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_OAUTH_BASE = 'https://oauth.reddit.com';
const USER_AGENT = 'AgenticAIAccounting/1.0';
const MAX_RESULTS = 50;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 2000;

interface RedditPost {
  kind: string;
  data: {
    id: string;
    name: string;
    title: string;
    selftext?: string;
    url: string;
    permalink: string;
    author: string;
    created_utc: number;
    is_self: boolean;
    thumbnail?: string;
    preview?: {
      images?: Array<{
        source?: { url: string };
      }>;
    };
    link_flair_text?: string;
    subreddit: string;
    num_comments: number;
    score: number;
    over_18: boolean;
    removed_by_category?: string;
  };
}

interface RedditListingResponse {
  kind: string;
  data: {
    children: RedditPost[];
    after: string | null;
  };
}

interface TokenResult {
  access_token: string;
  expires_at: number;
}

// Module-level token cache so we reuse tokens within a single cron run
let cachedToken: TokenResult | null = null;

async function getAccessToken(
  clientId: string,
  clientSecret: string
): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expires_at - 60_000) {
    return cachedToken.access_token;
  }

  const credentials = btoa(`${clientId}:${clientSecret}`);

  const response = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': USER_AGENT,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    throw new Error(
      `Reddit OAuth failed: ${response.status} ${response.statusText}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    token_type: string;
  };

  if (!data.access_token) {
    throw new Error('Reddit OAuth response missing access_token');
  }

  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

async function fetchWithRetry(
  url: string,
  token: string,
  attempt: number = 0
): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': USER_AGENT,
    },
  });

  if (response.status === 429 && attempt < MAX_RETRIES) {
    // Rate limited — exponential backoff
    const retryAfter = response.headers.get('Retry-After');
    const waitMs = retryAfter
      ? parseInt(retryAfter, 10) * 1000
      : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
    console.warn(
      `Reddit rate limited (429). Retrying in ${waitMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
    );
    await sleep(waitMs);
    return fetchWithRetry(url, token, attempt + 1);
  }

  return response;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapPostToArticle(
  post: RedditPost,
  sourceName: string
): CollectedArticle | null {
  const d = post.data;

  // Skip removed, deleted, or NSFW posts
  if (d.over_18 || d.removed_by_category) {
    return null;
  }

  // Skip posts with no title
  if (!d.title || d.title === '[deleted]' || d.title === '[removed]') {
    return null;
  }

  // Determine the URL: for link posts use the external URL,
  // for self posts use the Reddit permalink
  const articleUrl = d.is_self
    ? `https://www.reddit.com${d.permalink}`
    : d.url;

  // Build content snippet from selftext (for self posts) or title
  let contentSnippet: string | null = null;
  if (d.selftext && d.selftext.length > 0 && d.selftext !== '[deleted]' && d.selftext !== '[removed]') {
    contentSnippet = d.selftext.substring(0, 500);
  }

  // Extract the best available image
  let imageUrl: string | null = null;
  if (d.preview?.images?.[0]?.source?.url) {
    // Reddit HTML-encodes the URL in preview
    imageUrl = d.preview.images[0].source.url.replace(/&amp;/g, '&');
  } else if (
    d.thumbnail &&
    d.thumbnail !== 'self' &&
    d.thumbnail !== 'default' &&
    d.thumbnail !== 'nsfw' &&
    d.thumbnail !== 'spoiler' &&
    d.thumbnail.startsWith('http')
  ) {
    imageUrl = d.thumbnail;
  }

  // Convert Unix timestamp to ISO 8601
  const publishedAt = new Date(d.created_utc * 1000).toISOString();

  return {
    url: articleUrl,
    title: d.title,
    sourceType: 'reddit',
    sourceName,
    author: d.author && d.author !== '[deleted]' ? `u/${d.author}` : null,
    publishedAt,
    contentSnippet,
    imageUrl,
  };
}

async function searchSubreddit(
  subreddit: string,
  query: string,
  token: string,
  sourceName: string
): Promise<CollectedArticle[]> {
  const params = new URLSearchParams({
    q: query,
    restrict_sr: 'on',
    sort: 'new',
    t: 'day', // last 24 hours to match hourly fetch cadence with overlap
    limit: String(MAX_RESULTS),
    type: 'link',
  });

  const url = `${REDDIT_OAUTH_BASE}/r/${subreddit}/search?${params.toString()}`;
  const response = await fetchWithRetry(url, token);

  if (!response.ok) {
    console.error(
      `Reddit search failed for r/${subreddit}: ${response.status} ${response.statusText}`
    );
    return [];
  }

  const listing = (await response.json()) as RedditListingResponse;

  if (!listing?.data?.children) {
    console.warn(`Reddit search returned no children for r/${subreddit}`);
    return [];
  }

  const articles: CollectedArticle[] = [];
  for (const post of listing.data.children) {
    const article = mapPostToArticle(post, sourceName);
    if (article) {
      articles.push(article);
    }
  }

  return articles;
}

/**
 * Creates a Reddit collector that uses OAuth app-only flow.
 *
 * @param env - Must contain REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET
 * @returns A Collector that fetches from Reddit's search API
 */
export function createRedditCollector(env: {
  REDDIT_CLIENT_ID?: string;
  REDDIT_CLIENT_SECRET?: string;
}): Collector {
  return {
    async collect(config: SourceConfig): Promise<CollectedArticle[]> {
      try {
        const clientId = env.REDDIT_CLIENT_ID;
        const clientSecret = env.REDDIT_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
          console.error(
            'Reddit collector: missing REDDIT_CLIENT_ID or REDDIT_CLIENT_SECRET'
          );
          return [];
        }

        const subreddit = config.config.subreddit;
        const query = config.config.query;

        if (!subreddit) {
          console.error(
            `Reddit collector: source "${config.name}" missing subreddit in config`
          );
          return [];
        }

        if (!query) {
          console.error(
            `Reddit collector: source "${config.name}" missing query in config`
          );
          return [];
        }

        // Get OAuth token
        const token = await getAccessToken(clientId, clientSecret);

        // Search the subreddit
        const articles = await searchSubreddit(
          subreddit,
          query,
          token,
          config.name
        );

        console.log(
          `Reddit collector: fetched ${articles.length} articles from r/${subreddit}`
        );

        return articles;
      } catch (error) {
        console.error(
          `Reddit collector error for "${config.name}":`,
          error instanceof Error ? error.message : error
        );
        return [];
      }
    },
  };
}
