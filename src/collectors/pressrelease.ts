import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Press release collector for accounting + AI news.
 *
 * Fetches from PR Newswire and Business Wire RSS feeds, then filters
 * results locally by accounting/AI-related keywords.
 *
 * Default feeds:
 *   - PR Newswire: Financial Services latest news
 *   - Business Wire: Technology news
 *
 * Source type: 'rss'
 */

/** Default RSS feed URLs. */
const DEFAULT_FEEDS = [
  'https://www.prnewswire.com/rss/financial-services-latest-news.rss',
  'https://feed.businesswire.com/rss/home/?rss=G1QFDERJXkJeGVpTXQ==',
];

/** Keywords for filtering relevant press releases. */
const FILTER_KEYWORDS = [
  'accounting', 'bookkeeping', 'audit', 'tax',
  'ai', 'agentic', 'automation',
  'artificial intelligence', 'machine learning',
  'fintech', 'financial technology',
  'accounts payable', 'accounts receivable',
  'invoice', 'invoicing', 'billing',
  'erp', 'general ledger', 'reconciliation',
  'payroll', 'expense management',
  'cpa', 'accountant', 'controller',
];

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

/** Truncate a string to maxLen characters. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/** Extract text content from the first occurrence of an XML tag. Handles CDATA. */
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

/**
 * Check if title and description contain at least one accounting-related keyword
 * AND at least one AI/automation-related keyword.
 *
 * This ensures we only capture press releases at the intersection of
 * accounting and AI/automation, not all financial press releases.
 */
function isRelevant(title: string, description: string | null): boolean {
  const text = `${title} ${description || ''}`.toLowerCase();

  // Must match at least one keyword from the list
  return FILTER_KEYWORDS.some((kw) => text.includes(kw));
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(href: string | null | undefined, baseUrl: string): string | null {
  if (!href || !href.trim()) return null;
  try {
    return new URL(href.trim(), baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Parse a single RSS <item> from a press release feed.
 */
function parseItem(
  itemXml: string,
  sourceName: string,
  feedUrl: string
): CollectedArticle | null {
  const title = getTagContent(itemXml, 'title');
  const link = getTagContent(itemXml, 'link');

  if (!title || !link) return null;

  const cleanTitle = stripHtml(title).trim();
  const resolvedLink = resolveUrl(stripHtml(link), feedUrl);
  if (!resolvedLink) return null;

  // Parse date
  const pubDateRaw = getTagContent(itemXml, 'pubDate')
    || getTagContent(itemXml, 'dc:date');
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

  // Filter by keywords
  if (!isRelevant(cleanTitle, contentSnippet)) {
    return null;
  }

  // Author — press releases sometimes have dc:creator
  const author = getTagContent(itemXml, 'dc:creator')
    || getTagContent(itemXml, 'author');

  return {
    url: resolvedLink,
    title: cleanTitle,
    sourceType: 'rss',
    sourceName,
    author: author ? stripHtml(author) : null,
    publishedAt,
    contentSnippet,
    imageUrl: null,
  };
}

/**
 * Fetch and parse articles from a single RSS feed URL.
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
      console.error(`[PressRelease] HTTP ${response.status} fetching ${feedUrl}`);
      return [];
    }

    const xml = await response.text();
    if (!xml.trim()) {
      console.error(`[PressRelease] Empty response from ${feedUrl}`);
      return [];
    }

    const items = splitByTag(xml, 'item');
    const articles: CollectedArticle[] = [];

    for (const item of items) {
      try {
        const article = parseItem(item, sourceName, feedUrl);
        if (article) articles.push(article);
      } catch (err) {
        console.error(`[PressRelease] Error parsing item from ${feedUrl}:`, err);
      }
    }

    return articles;
  } catch (err) {
    console.error(`[PressRelease] Error fetching ${feedUrl}:`, err);
    return [];
  }
}

/**
 * Normalize a URL for deduplication.
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

export const pressReleaseCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    try {
      // Use configured feed URLs or defaults
      const feedUrlsRaw = config.config['feeds'] || config.config['url'] || '';
      const feedUrls = feedUrlsRaw
        ? feedUrlsRaw.split(',').map((u) => u.trim()).filter((u) => u.length > 0)
        : DEFAULT_FEEDS;

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
        `[PressRelease] Collected ${allArticles.length} relevant articles from ${feedUrls.length} feeds`
      );

      return allArticles;
    } catch (err) {
      console.error('[PressRelease] Unexpected error:', err);
      return [];
    }
  },
};
