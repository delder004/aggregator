import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * RSS/Atom feed collector for Cloudflare Workers.
 *
 * Handles both RSS 2.0 and Atom feed formats using the built-in DOMParser.
 * Extracts title, link, pubDate, description (truncated to 500 chars),
 * and thumbnail (media:thumbnail or enclosure). Resolves relative URLs
 * against the feed's base URL and handles CDATA content.
 */

// -- DOM type declarations for XML parsing in Cloudflare Workers --
// The Workers runtime supports DOMParser but @cloudflare/workers-types
// does not include the standard DOM typings. We declare the subset we need.

interface XMLElement {
  tagName: string;
  textContent: string | null;
  getElementsByTagName(name: string): XMLNodeList;
  getAttribute(name: string): string | null;
}

interface XMLNodeList {
  readonly length: number;
  [index: number]: XMLElement;
}

interface XMLDocument {
  getElementsByTagName(name: string): XMLNodeList;
}

interface XMLDOMParser {
  parseFromString(source: string, mimeType: string): XMLDocument;
}

declare const DOMParser: {
  new (): XMLDOMParser;
};

/** Strip HTML tags from a string. */
function stripHtml(html: string): string {
  // Remove HTML tags, decode common entities, and collapse whitespace
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
  return text.slice(0, maxLen - 1).trim() + '\u2026';
}

/** Resolve a potentially relative URL against a base URL. Returns null for invalid URLs. */
function resolveUrl(href: string | null | undefined, baseUrl: string): string | null {
  if (!href || !href.trim()) return null;
  try {
    return new URL(href.trim(), baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Get the text content of the first matching element within a parent node.
 * Handles CDATA by using textContent (DOMParser already unwraps CDATA for us).
 */
function getElementText(parent: XMLElement, tagName: string): string | null {
  const el = parent.getElementsByTagName(tagName)[0];
  if (!el) return null;
  const text = el.textContent?.trim() ?? null;
  return text || null;
}

/**
 * Try multiple tag names and return the first non-null text result.
 */
function getElementTextAny(parent: XMLElement, tagNames: string[]): string | null {
  for (const tag of tagNames) {
    const text = getElementText(parent, tag);
    if (text) return text;
  }
  return null;
}

/**
 * Parse an RSS 2.0 <item> element into a CollectedArticle.
 */
function parseRssItem(
  item: XMLElement,
  sourceName: string,
  feedUrl: string
): CollectedArticle | null {
  const title = getElementText(item, 'title');
  const link = getElementText(item, 'link');

  if (!title || !link) return null;

  const resolvedLink = resolveUrl(link, feedUrl);
  if (!resolvedLink) return null;

  // pubDate in RSS 2.0 is RFC 822 format
  const pubDateRaw = getElementTextAny(item, ['pubDate', 'dc:date']);
  let publishedAt: string;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  // Description/content - prefer content:encoded, fall back to description
  const rawContent = getElementTextAny(item, ['content:encoded', 'description']);
  const contentSnippet = rawContent
    ? truncate(stripHtml(rawContent), 500)
    : null;

  // Author - try multiple fields
  const author = getElementTextAny(item, ['author', 'dc:creator', 'creator']);

  // Thumbnail - try media:thumbnail, media:content, itunes:image, then enclosure
  const imageUrl = extractImageFromRssItem(item, feedUrl);

  return {
    url: resolvedLink,
    title: title.trim(),
    sourceType: 'rss',
    sourceName,
    author,
    publishedAt,
    contentSnippet,
    imageUrl,
  };
}

/**
 * Extract an image URL from an RSS item, trying multiple common conventions.
 */
function extractImageFromRssItem(item: XMLElement, feedUrl: string): string | null {
  // Try media:thumbnail
  const mediaThumbnail = item.getElementsByTagName('media:thumbnail')[0];
  if (mediaThumbnail) {
    const url = mediaThumbnail.getAttribute('url');
    if (url) return resolveUrl(url, feedUrl);
  }

  // Try media:content with type image/*
  const mediaContents = item.getElementsByTagName('media:content');
  for (let i = 0; i < mediaContents.length; i++) {
    const mc = mediaContents[i];
    const medium = mc.getAttribute('medium');
    const type = mc.getAttribute('type');
    const url = mc.getAttribute('url');
    if (url && (medium === 'image' || type?.startsWith('image/'))) {
      return resolveUrl(url, feedUrl);
    }
  }

  // Try itunes:image
  const itunesImage = item.getElementsByTagName('itunes:image')[0];
  if (itunesImage) {
    const href = itunesImage.getAttribute('href');
    if (href) return resolveUrl(href, feedUrl);
  }

  // Try enclosure with type image/*
  const enclosures = item.getElementsByTagName('enclosure');
  for (let i = 0; i < enclosures.length; i++) {
    const enc = enclosures[i];
    const type = enc.getAttribute('type');
    const url = enc.getAttribute('url');
    if (url && type?.startsWith('image/')) {
      return resolveUrl(url, feedUrl);
    }
  }

  return null;
}

/**
 * Parse an Atom <entry> element into a CollectedArticle.
 */
function parseAtomEntry(
  entry: XMLElement,
  sourceName: string,
  feedUrl: string
): CollectedArticle | null {
  const title = getElementText(entry, 'title');
  if (!title) return null;

  // Atom links: prefer rel="alternate", otherwise first <link> with an href
  const link = extractAtomLink(entry, feedUrl);
  if (!link) return null;

  // published or updated
  const pubDateRaw = getElementTextAny(entry, ['published', 'updated']);
  let publishedAt: string;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  // Content or summary
  const rawContent = getElementTextAny(entry, ['content', 'summary']);
  const contentSnippet = rawContent
    ? truncate(stripHtml(rawContent), 500)
    : null;

  // Author
  const authorEl = entry.getElementsByTagName('author')[0];
  const author = authorEl ? getElementText(authorEl, 'name') : null;

  // Thumbnail - try media:thumbnail, media:content, then look for link with image type
  const imageUrl = extractImageFromAtomEntry(entry, feedUrl);

  return {
    url: link,
    title: title.trim(),
    sourceType: 'rss',
    sourceName,
    author,
    publishedAt,
    contentSnippet,
    imageUrl,
  };
}

/**
 * Extract the primary link from an Atom entry.
 * Prefers rel="alternate", then any link with an href.
 */
function extractAtomLink(entry: XMLElement, feedUrl: string): string | null {
  const links = entry.getElementsByTagName('link');
  let alternateHref: string | null = null;
  let firstHref: string | null = null;

  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const href = link.getAttribute('href');
    if (!href) continue;

    const rel = link.getAttribute('rel') || 'alternate';
    if (rel === 'alternate' && !alternateHref) {
      alternateHref = href;
    }
    if (!firstHref) {
      firstHref = href;
    }
  }

  const chosen = alternateHref || firstHref;
  return chosen ? resolveUrl(chosen, feedUrl) : null;
}

/**
 * Extract an image URL from an Atom entry.
 */
function extractImageFromAtomEntry(entry: XMLElement, feedUrl: string): string | null {
  // Try media:thumbnail
  const mediaThumbnail = entry.getElementsByTagName('media:thumbnail')[0];
  if (mediaThumbnail) {
    const url = mediaThumbnail.getAttribute('url');
    if (url) return resolveUrl(url, feedUrl);
  }

  // Try media:content with image type
  const mediaContents = entry.getElementsByTagName('media:content');
  for (let i = 0; i < mediaContents.length; i++) {
    const mc = mediaContents[i];
    const medium = mc.getAttribute('medium');
    const type = mc.getAttribute('type');
    const url = mc.getAttribute('url');
    if (url && (medium === 'image' || type?.startsWith('image/'))) {
      return resolveUrl(url, feedUrl);
    }
  }

  // Try link with type starting with image/
  const links = entry.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const link = links[i];
    const type = link.getAttribute('type');
    const rel = link.getAttribute('rel');
    const href = link.getAttribute('href');
    if (href && type?.startsWith('image/') && rel === 'enclosure') {
      return resolveUrl(href, feedUrl);
    }
  }

  return null;
}

/**
 * Detect whether a parsed XML document is Atom or RSS 2.0.
 * Returns 'atom' | 'rss' | null if unknown.
 */
function detectFeedFormat(doc: XMLDocument): 'atom' | 'rss' | null {
  // Atom feeds have a root <feed> element
  if (doc.getElementsByTagName('feed').length > 0) return 'atom';
  // RSS feeds have a root <rss> element (or <rdf:RDF>)
  if (doc.getElementsByTagName('rss').length > 0) return 'rss';
  if (doc.getElementsByTagName('rdf:RDF').length > 0) return 'rss';
  // Some RSS feeds may have <channel> directly
  if (doc.getElementsByTagName('channel').length > 0) return 'rss';
  return null;
}

/**
 * Parse an RSS 2.0 feed document into CollectedArticle[].
 */
function parseRssFeed(
  doc: XMLDocument,
  sourceName: string,
  feedUrl: string
): CollectedArticle[] {
  const items = doc.getElementsByTagName('item');
  const articles: CollectedArticle[] = [];

  for (let i = 0; i < items.length; i++) {
    try {
      const article = parseRssItem(items[i], sourceName, feedUrl);
      if (article) {
        articles.push(article);
      }
    } catch (err) {
      console.error(`[RSS] Error parsing RSS item ${i} from ${feedUrl}:`, err);
    }
  }

  return articles;
}

/**
 * Parse an Atom feed document into CollectedArticle[].
 */
function parseAtomFeed(
  doc: XMLDocument,
  sourceName: string,
  feedUrl: string
): CollectedArticle[] {
  const entries = doc.getElementsByTagName('entry');
  const articles: CollectedArticle[] = [];

  for (let i = 0; i < entries.length; i++) {
    try {
      const article = parseAtomEntry(entries[i], sourceName, feedUrl);
      if (article) {
        articles.push(article);
      }
    } catch (err) {
      console.error(`[RSS] Error parsing Atom entry ${i} from ${feedUrl}:`, err);
    }
  }

  return articles;
}

/**
 * RSS/Atom feed collector implementing the Collector interface.
 *
 * Usage:
 *   const collector = new RssCollector();
 *   const articles = await collector.collect(sourceConfig);
 *
 * The sourceConfig.config.url should contain the feed URL to fetch.
 */
export class RssCollector implements Collector {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    const feedUrl = config.config.url;
    if (!feedUrl) {
      console.error(`[RSS] No URL configured for source "${config.name}"`);
      return [];
    }

    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'AgenticAIAccounting/1.0 (news aggregator)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });

      if (!response.ok) {
        console.error(
          `[RSS] HTTP ${response.status} fetching ${feedUrl}`
        );
        return [];
      }

      const xml = await response.text();
      if (!xml.trim()) {
        console.error(`[RSS] Empty response from ${feedUrl}`);
        return [];
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(xml, 'application/xml');

      // Check for XML parse errors
      const parseError = doc.getElementsByTagName('parsererror');
      if (parseError.length > 0) {
        console.error(
          `[RSS] XML parse error for ${feedUrl}:`,
          parseError[0].textContent
        );
        return [];
      }

      const format = detectFeedFormat(doc);
      if (!format) {
        console.error(`[RSS] Unknown feed format for ${feedUrl}`);
        return [];
      }

      const articles =
        format === 'atom'
          ? parseAtomFeed(doc, config.name, feedUrl)
          : parseRssFeed(doc, config.name, feedUrl);

      console.log(
        `[RSS] Collected ${articles.length} articles from ${config.name} (${feedUrl})`
      );
      return articles;
    } catch (err) {
      console.error(`[RSS] Error collecting from ${config.name} (${feedUrl}):`, err);
      return [];
    }
  }
}

/** Default singleton instance for convenience. */
export const rssCollector = new RssCollector();
