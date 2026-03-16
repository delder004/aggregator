import type { Collector, CollectedArticle, SourceConfig } from '../types';
import { rssCollector } from './rss';

/**
 * Strip HTML tags from a string (local copy for content extraction).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Truncate a string to maxLen characters, adding ellipsis if truncated.
 */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/**
 * Extract text content from the first occurrence of a tag in an XML block.
 * Handles CDATA sections.
 */
function getTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`,
    'i'
  );
  const match = xml.match(regex);
  if (!match) return null;
  let content = match[1].trim();
  // Unwrap CDATA
  const cdataMatch = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) {
    content = cdataMatch[1];
  }
  return content || null;
}

/**
 * Split XML into blocks by a given tag name.
 */
function splitByTag(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, 'gi');
  return xml.match(regex) || [];
}

/**
 * Try to extract a longer content snippet (up to 1000 chars) from the raw
 * Substack feed XML for a given article URL.  Substack feeds typically
 * include the full post body in `content:encoded`, so we can give the
 * classifier significantly more context than the default RSS collector's
 * 500-char limit.
 *
 * Returns a map of article URL -> extended snippet.
 */
function extractExtendedSnippets(xml: string): Map<string, string> {
  const snippets = new Map<string, string>();

  const items = splitByTag(xml, 'item');
  for (const item of items) {
    try {
      // Get the link
      const linkMatch = item.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
      if (!linkMatch) continue;
      let link = linkMatch[1].trim();
      const cdataLink = link.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
      if (cdataLink) link = cdataLink[1];
      link = stripHtml(link).trim();
      if (!link) continue;

      // Try content:encoded first (Substack's full post body), then description
      const rawContent = getTagContent(item, 'content:encoded')
        || getTagContent(item, 'description');
      if (!rawContent) continue;

      const stripped = stripHtml(rawContent);
      if (stripped.length > 0) {
        snippets.set(link, truncate(stripped, 1000));
      }
    } catch {
      // Skip individual item failures
    }
  }

  return snippets;
}

/**
 * Substack newsletter collector.
 *
 * Delegates to the standard rssCollector since Substack feeds are RSS 2.0,
 * then overrides sourceType to 'substack' and extends content snippets
 * to up to 1000 characters for better classifier signal.
 */
export const substackCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    const feedUrl = config.config.url;
    if (!feedUrl) {
      console.error(`[Substack] No URL configured for source "${config.name}"`);
      return [];
    }

    try {
      // Delegate to rssCollector for the actual parsing
      const articles = await rssCollector.collect(config);

      // If we got articles, fetch the feed again to extract extended snippets.
      // We need the raw XML which rssCollector doesn't expose.
      let extendedSnippets: Map<string, string> = new Map();
      if (articles.length > 0) {
        try {
          const response = await fetch(feedUrl, {
            headers: {
              'User-Agent': 'AgenticAIAccounting/1.0 (news aggregator)',
              Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
            },
          });
          if (response.ok) {
            const xml = await response.text();
            extendedSnippets = extractExtendedSnippets(xml);
          }
        } catch {
          // Non-fatal — we still have the articles with standard snippets
          console.error(`[Substack] Failed to fetch extended snippets from ${feedUrl}`);
        }
      }

      // Override sourceType and apply extended snippets
      for (const article of articles) {
        article.sourceType = 'substack';
        const extended = extendedSnippets.get(article.url);
        if (extended && extended.length > (article.contentSnippet?.length ?? 0)) {
          article.contentSnippet = extended;
        }
      }

      console.log(`[Substack] Collected ${articles.length} articles from ${config.name} (${feedUrl})`);
      return articles;
    } catch (err) {
      console.error(`[Substack] Error collecting from ${config.name} (${feedUrl}):`, err);
      return [];
    }
  },
};
