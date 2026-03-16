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

        // Extract and clean title
        const title = stripHtml(rawTitle);
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
