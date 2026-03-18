import type { Collector, CollectedArticle, SourceConfig } from '../types';
import { fetchYouTubeTranscript } from './transcript';

/**
 * YouTube Data API v3 response types (subset we use).
 */
interface YouTubeSearchResult {
  id: {
    kind: string;
    videoId?: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      medium?: { url: string; width: number; height: number };
      default?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    liveBroadcastContent: string;
  };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchResult[];
  pageInfo?: {
    totalResults: number;
    resultsPerPage: number;
  };
  error?: {
    code: number;
    message: string;
    errors: Array<{ reason: string }>;
  };
}

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Maximum results per search request. Keep low to conserve quota.
 * Each search request costs 100 quota units out of 10K daily.
 */
const MAX_RESULTS_PER_SEARCH = 15;

/**
 * Maximum number of transcript fetches per collection run.
 * Supadata free tier allows ~100/month; with hourly runs, cap at 5 per run.
 */
const MAX_TRANSCRIPT_FETCHES = 5;

/**
 * Creates a YouTube collector that uses the YouTube Data API v3.
 *
 * The SourceConfig.config should contain either:
 * - `query`: a search term (e.g., "AI accounting")
 * - `channelId`: a YouTube channel ID (e.g., "UC00MExfC3vuP9680IUW0jLA")
 *
 * If both are provided, it searches within the specified channel for the query.
 * If only channelId is provided, it fetches recent uploads from that channel.
 * If only query is provided, it does a global search.
 */
export function createYouTubeCollector(env: { YOUTUBE_API_KEY?: string; SUPADATA_API_KEY?: string }): Collector {
  return {
    async collect(config: SourceConfig): Promise<CollectedArticle[]> {
      try {
        const apiKey = env.YOUTUBE_API_KEY;
        if (!apiKey) {
          console.error(`[YouTube] No API key configured, skipping source "${config.name}"`);
          return [];
        }

        const { query, channelId } = config.config;

        if (!query && !channelId) {
          console.error(`[YouTube] Source "${config.name}" has neither query nor channelId configured`);
          return [];
        }

        const results = await searchYouTube(apiKey, { query, channelId, sourceName: config.name });

        // Fetch transcripts if Supadata API key is configured
        if (env.SUPADATA_API_KEY) {
          let transcriptsFetched = 0;
          for (const article of results) {
            if (transcriptsFetched >= MAX_TRANSCRIPT_FETCHES) break;

            // Extract video ID from URL
            const videoId = extractVideoId(article.url);
            if (!videoId) continue;

            try {
              const transcript = await fetchYouTubeTranscript(videoId, env.SUPADATA_API_KEY);
              if (transcript) {
                article.transcript = transcript;
                transcriptsFetched++;
                console.log(`[YouTube] Fetched transcript for "${article.title}" (${transcript.length} chars)`);
              }
            } catch (err) {
              console.error(`[YouTube] Transcript fetch failed for "${article.title}":`, err);
            }
          }
          if (transcriptsFetched > 0) {
            console.log(`[YouTube] Fetched ${transcriptsFetched} transcripts for source "${config.name}"`);
          }
        }

        return results;
      } catch (error) {
        console.error(`[YouTube] Error collecting from source "${config.name}":`, error);
        return [];
      }
    },
  };
}

/**
 * Extract YouTube video ID from a YouTube URL.
 */
function extractVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtube.com' || parsed.hostname === 'www.youtube.com') {
      return parsed.searchParams.get('v');
    }
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1) || null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Performs a YouTube Data API v3 search and returns CollectedArticle[].
 */
async function searchYouTube(
  apiKey: string,
  opts: { query?: string; channelId?: string; sourceName: string }
): Promise<CollectedArticle[]> {
  const url = new URL(`${YOUTUBE_API_BASE}/search`);

  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('order', 'date');
  url.searchParams.set('maxResults', String(MAX_RESULTS_PER_SEARCH));
  url.searchParams.set('key', apiKey);

  // Filter to videos published in the last 24 hours to stay current
  const publishedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  url.searchParams.set('publishedAfter', publishedAfter);

  // Exclude live broadcasts — we only want completed videos
  url.searchParams.set('eventType', 'completed');

  if (opts.query) {
    url.searchParams.set('q', opts.query);
  }

  if (opts.channelId) {
    url.searchParams.set('channelId', opts.channelId);
  }

  // Set relevanceLanguage to English for better results
  url.searchParams.set('relevanceLanguage', 'en');

  const response = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(
      `[YouTube] API request failed (${response.status}) for source "${opts.sourceName}": ${errorBody}`
    );

    // If quota exceeded, log a specific warning
    if (response.status === 403) {
      console.error('[YouTube] Possible quota exceeded — consider reducing search frequency');
    }

    return [];
  }

  const data: YouTubeSearchResponse = await response.json();

  if (data.error) {
    console.error(`[YouTube] API error for source "${opts.sourceName}":`, data.error.message);
    return [];
  }

  if (!data.items || data.items.length === 0) {
    return [];
  }

  const articles: CollectedArticle[] = [];

  for (const item of data.items) {
    // Only process video results (skip channels, playlists)
    if (item.id.kind !== 'youtube#video' || !item.id.videoId) {
      continue;
    }

    // Skip live broadcasts and upcoming streams
    if (
      item.snippet.liveBroadcastContent === 'live' ||
      item.snippet.liveBroadcastContent === 'upcoming'
    ) {
      continue;
    }

    const videoUrl = `https://youtube.com/watch?v=${item.id.videoId}`;
    const thumbnailUrl = item.snippet.thumbnails.medium?.url
      ?? item.snippet.thumbnails.default?.url
      ?? null;

    // Decode HTML entities in title and description (YouTube API returns encoded HTML)
    const title = decodeHTMLEntities(item.snippet.title);
    const description = decodeHTMLEntities(item.snippet.description);

    const article: CollectedArticle = {
      url: videoUrl,
      title,
      sourceType: 'youtube',
      sourceName: opts.sourceName,
      author: item.snippet.channelTitle || null,
      publishedAt: item.snippet.publishedAt,
      contentSnippet: description ? truncate(description, 500) : null,
      imageUrl: thumbnailUrl,
    };

    articles.push(article);
  }

  return articles;
}

/**
 * Truncates a string to the specified max length, breaking at word boundaries
 * when possible and appending an ellipsis.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to break at a word boundary
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.slice(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Decodes common HTML entities that YouTube's API returns in titles/descriptions.
 * Uses a simple replacement approach since DOMParser is heavier than needed here.
 */
function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&apos;/g, "'");
}
