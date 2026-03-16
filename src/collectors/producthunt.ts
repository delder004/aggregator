import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Product Hunt collector for accounting, fintech, and AI products.
 *
 * Fetches from Product Hunt's public topics RSS feeds. If a PRODUCTHUNT_API_TOKEN
 * is provided in config, it can also query their GraphQL API for more targeted results.
 * Falls back to scraping public topic pages as RSS.
 *
 * Source type: 'rss' (uses existing RSS-compatible type)
 */

/** Strip HTML tags from a string. */
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

/** Truncate a string to maxLen characters, adding ellipsis if truncated. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/** Extract text content from an XML tag. Handles CDATA. */
function getTagContent(xml: string, tagName: string): string | null {
  const regex = new RegExp(
    `<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`,
    'i'
  );
  const match = xml.match(regex);
  if (!match) return null;
  let content = match[1].trim();
  const cdataMatch = content.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  if (cdataMatch) {
    content = cdataMatch[1];
  }
  return content || null;
}

/** Split XML into blocks by tag name. */
function splitByTag(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, 'gi');
  return xml.match(regex) || [];
}

/** Default Product Hunt topic RSS feed URLs for accounting/fintech/AI. */
const DEFAULT_TOPIC_FEEDS = [
  'https://www.producthunt.com/topics/artificial-intelligence/rss',
  'https://www.producthunt.com/topics/fintech/rss',
  'https://www.producthunt.com/topics/accounting/rss',
];

/** Keywords for filtering relevant products. */
const RELEVANCE_KEYWORDS = [
  'accounting', 'bookkeeping', 'audit', 'tax', 'invoice',
  'fintech', 'finance', 'agentic', 'ai agent', 'automation',
  'payroll', 'expense', 'receipt', 'ledger', 'erp',
  'accounts payable', 'accounts receivable', 'reconciliation',
  'financial', 'billing', 'payment',
];

/** Check if text contains any relevance keywords. */
function isRelevant(title: string, description: string | null): boolean {
  const text = `${title} ${description || ''}`.toLowerCase();
  return RELEVANCE_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Parse a single RSS <item> from a Product Hunt feed.
 */
function parseItem(
  itemXml: string,
  sourceName: string
): CollectedArticle | null {
  const title = getTagContent(itemXml, 'title');
  const link = getTagContent(itemXml, 'link');

  if (!title || !link) return null;

  const cleanTitle = stripHtml(title).trim();
  const cleanLink = stripHtml(link).trim();

  if (!cleanLink) return null;

  // Parse date
  const pubDateRaw = getTagContent(itemXml, 'pubDate');
  let publishedAt: string;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  // Description
  const rawDesc = getTagContent(itemXml, 'description');
  const contentSnippet = rawDesc
    ? truncate(stripHtml(rawDesc), 500)
    : null;

  // Filter for relevance
  if (!isRelevant(cleanTitle, contentSnippet)) {
    return null;
  }

  return {
    url: cleanLink,
    title: cleanTitle,
    sourceType: 'rss',
    sourceName,
    author: null,
    publishedAt,
    contentSnippet,
    imageUrl: null,
  };
}

/**
 * Fetch articles from a single RSS feed URL.
 */
async function fetchFeed(
  feedUrl: string,
  sourceName: string
): Promise<CollectedArticle[]> {
  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'AgenticAIAccounting/1.0 (news aggregator)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
    });

    if (!response.ok) {
      console.error(`[ProductHunt] HTTP ${response.status} fetching ${feedUrl}`);
      return [];
    }

    const xml = await response.text();
    if (!xml.trim()) {
      console.error(`[ProductHunt] Empty response from ${feedUrl}`);
      return [];
    }

    const items = splitByTag(xml, 'item');
    const articles: CollectedArticle[] = [];

    for (const item of items) {
      try {
        const article = parseItem(item, sourceName);
        if (article) articles.push(article);
      } catch (err) {
        console.error(`[ProductHunt] Error parsing item from ${feedUrl}:`, err);
      }
    }

    return articles;
  } catch (err) {
    console.error(`[ProductHunt] Error fetching ${feedUrl}:`, err);
    return [];
  }
}

/**
 * Normalize a URL for deduplication (lowercase hostname, strip trailing slash).
 */
function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.hostname = parsed.hostname.toLowerCase();
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return rawUrl.toLowerCase();
  }
}

export const productHuntCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    try {
      // Use configured feed URLs or defaults
      const feedUrlsRaw = config.config['feeds'] || config.config['url'] || '';
      const feedUrls = feedUrlsRaw
        ? feedUrlsRaw.split(',').map((u) => u.trim()).filter((u) => u.length > 0)
        : DEFAULT_TOPIC_FEEDS;

      const allArticles: CollectedArticle[] = [];
      const seenUrls = new Set<string>();

      // Fetch all feeds
      const results = await Promise.all(
        feedUrls.map((url) => fetchFeed(url, config.name))
      );

      for (const articles of results) {
        for (const article of articles) {
          const normalized = normalizeUrl(article.url);
          if (!seenUrls.has(normalized)) {
            seenUrls.add(normalized);
            allArticles.push(article);
          }
        }
      }

      console.log(
        `[ProductHunt] Collected ${allArticles.length} relevant articles from ${feedUrls.length} feeds`
      );

      return allArticles;
    } catch (err) {
      console.error('[ProductHunt] Unexpected error:', err);
      return [];
    }
  },
};
