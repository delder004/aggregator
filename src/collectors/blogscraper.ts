import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Blog scraper collector — fetches HTML blog listing pages and extracts
 * article links for companies that don't have RSS feeds.
 *
 * Config fields:
 *   - url: The blog listing page URL (e.g., "https://www.rillet.com/blog")
 *   - company: The company name
 *   - articlePathPrefix: URL path prefix for blog posts (e.g., "/blog/").
 *     Only links matching this prefix are collected.
 */

const MAX_ARTICLES_PER_SOURCE = 20;

// Match <a> tags, capturing href and inner text
const LINK_REGEX = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

// Strip HTML tags from a string
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Decode common HTML entities that the simple stripHtml misses.
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

/**
 * Sanitize a scraped blog title by removing common noise patterns:
 * - Leading "Article" prefix
 * - Leading date patterns (e.g., "March 01, 2026")
 * - Trailing author/team suffixes
 * - HTML entities
 * - Overly long titles truncated at a sentence boundary
 */
export function sanitizeTitle(raw: string): string {
  let title = raw.trim();

  // Decode HTML entities
  title = decodeHtmlEntities(title);

  // Strip leading "Article" prefix (case-insensitive, word boundary)
  title = title.replace(/^Article\b\s*/i, '');

  // Strip leading date patterns: "Month DD, YYYY" at start of string
  title = title.replace(
    /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\s*/i,
    ''
  );

  // Strip trailing known author/team suffixes
  title = title.replace(/(?:Team|Staff|Editor|Admin|Blog)$/i, '').trim();

  // Truncate at the first natural sentence boundary if title is > 120 chars
  if (title.length > 120) {
    // Look for ". " or " — " or ": " after 40 chars
    const breakPoints = [
      title.indexOf('. ', 40),
      title.indexOf(' — ', 40),
      title.indexOf(': ', 40),
    ].filter((i) => i > 0);

    if (breakPoints.length > 0) {
      const breakAt = Math.min(...breakPoints);
      // Include the period/colon but not the space after
      title = title.slice(0, breakAt + 1);
    } else {
      // Hard truncate
      title = title.slice(0, 117) + '...';
    }
  }

  return title.trim();
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(href: string, baseUrl: string): string {
  try {
    // If it's already absolute, this will work directly
    return new URL(href, baseUrl).href;
  } catch {
    return '';
  }
}

export const blogScraperCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    const blogUrl = config.config['url'];
    const company = config.config['company'];
    const articlePathPrefix = config.config['articlePathPrefix'];

    if (!blogUrl) {
      console.error(`[BlogScraper] No URL configured for source "${config.name}"`);
      return [];
    }
    if (!company) {
      console.error(`[BlogScraper] No company configured for source "${config.name}"`);
      return [];
    }
    if (!articlePathPrefix) {
      console.error(`[BlogScraper] No articlePathPrefix configured for source "${config.name}"`);
      return [];
    }

    try {
      console.log(`[BlogScraper] Fetching ${blogUrl} for ${company}`);

      const response = await fetch(blogUrl, {
        headers: {
          'User-Agent': 'AgenticAIAccounting/1.0 (news aggregator)',
          'Accept': 'text/html',
        },
      });

      if (!response.ok) {
        console.error(
          `[BlogScraper] HTTP ${response.status} fetching ${blogUrl}`
        );
        return [];
      }

      const html = await response.text();

      // Extract all <a> tags with href and inner text
      const seen = new Set<string>();
      const articles: CollectedArticle[] = [];
      const now = new Date().toISOString();

      let match: RegExpExecArray | null;
      // Reset regex state
      LINK_REGEX.lastIndex = 0;

      while ((match = LINK_REGEX.exec(html)) !== null) {
        const href = match[1];
        const rawTitle = match[2];

        // Resolve relative URLs
        const fullUrl = resolveUrl(href, blogUrl);
        if (!fullUrl) continue;

        // Check if the URL path matches the article path prefix
        let urlPath: string;
        try {
          urlPath = new URL(fullUrl).pathname;
        } catch {
          continue;
        }

        if (!urlPath.startsWith(articlePathPrefix)) continue;

        // Skip if the path is exactly the prefix (listing page itself)
        if (urlPath === articlePathPrefix || urlPath === articlePathPrefix.replace(/\/$/, '')) continue;

        // Deduplicate by URL
        if (seen.has(fullUrl)) continue;
        seen.add(fullUrl);

        // Extract, clean, and sanitize title
        const title = sanitizeTitle(stripHtml(rawTitle));
        if (!title || title.length < 5) continue;

        articles.push({
          url: fullUrl,
          title,
          sourceType: 'blogscraper',
          sourceName: `${company} Blog`,
          author: null,
          publishedAt: now,
          contentSnippet: null,
          imageUrl: null,
        });

        if (articles.length >= MAX_ARTICLES_PER_SOURCE) break;
      }

      console.log(
        `[BlogScraper] Collected ${articles.length} articles from ${company} blog`
      );

      return articles;
    } catch (err) {
      console.error(
        `[BlogScraper] Error collecting from "${config.name}":`,
        err
      );
      return [];
    }
  },
};
