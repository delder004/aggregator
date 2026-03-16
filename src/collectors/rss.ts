import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * RSS/Atom feed collector for Cloudflare Workers.
 *
 * Handles both RSS 2.0 and Atom feed formats using regex-based XML parsing.
 * Extracts title, link, pubDate, description (truncated to 500 chars),
 * and thumbnail (media:thumbnail or enclosure). Resolves relative URLs
 * against the feed's base URL and handles CDATA content.
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

/** Resolve a potentially relative URL against a base URL. */
function resolveUrl(href: string | null | undefined, baseUrl: string): string | null {
  if (!href || !href.trim()) return null;
  try {
    return new URL(href.trim(), baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Extract text content from the first occurrence of a tag in an XML block.
 * Handles CDATA sections.
 */
function getTagContent(xml: string, tagName: string): string | null {
  // Match both self-closing and content-bearing tags, including namespaced tags
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
 * Get an attribute value from the first occurrence of a tag.
 */
function getTagAttribute(xml: string, tagName: string, attrName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*?${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const match = xml.match(regex);
  if (!match) {
    // Try single quotes
    const regex2 = new RegExp(`<${tagName}[^>]*?${attrName}\\s*=\\s*'([^']*)'`, 'i');
    const match2 = xml.match(regex2);
    return match2?.[1] ?? null;
  }
  return match[1] ?? null;
}

/**
 * Split XML into blocks by a given tag name.
 */
function splitByTag(xml: string, tagName: string): string[] {
  const regex = new RegExp(`<${tagName}[\\s>][\\s\\S]*?</${tagName}>`, 'gi');
  return xml.match(regex) || [];
}

/**
 * Detect whether XML is Atom or RSS.
 */
function detectFormat(xml: string): 'atom' | 'rss' | null {
  if (/<feed[\s>]/i.test(xml)) return 'atom';
  if (/<rss[\s>]/i.test(xml)) return 'rss';
  if (/<rdf:RDF[\s>]/i.test(xml)) return 'rss';
  if (/<channel[\s>]/i.test(xml)) return 'rss';
  return null;
}

/**
 * Extract an image URL from an RSS item block.
 */
function extractRssImage(itemXml: string, feedUrl: string): string | null {
  // media:thumbnail
  const mediaThumbnailUrl = getTagAttribute(itemXml, 'media:thumbnail', 'url');
  if (mediaThumbnailUrl) return resolveUrl(mediaThumbnailUrl, feedUrl);

  // media:content with image type
  const mediaContentUrl = getTagAttribute(itemXml, 'media:content', 'url');
  if (mediaContentUrl) {
    const medium = getTagAttribute(itemXml, 'media:content', 'medium');
    const type = getTagAttribute(itemXml, 'media:content', 'type');
    if (medium === 'image' || type?.startsWith('image/')) {
      return resolveUrl(mediaContentUrl, feedUrl);
    }
  }

  // itunes:image
  const itunesHref = getTagAttribute(itemXml, 'itunes:image', 'href');
  if (itunesHref) return resolveUrl(itunesHref, feedUrl);

  // enclosure with image type
  const enclosureUrl = getTagAttribute(itemXml, 'enclosure', 'url');
  if (enclosureUrl) {
    const encType = getTagAttribute(itemXml, 'enclosure', 'type');
    if (encType?.startsWith('image/')) {
      return resolveUrl(enclosureUrl, feedUrl);
    }
  }

  return null;
}

/**
 * Extract the link from an Atom entry.
 * Prefers rel="alternate", otherwise the first <link> with an href.
 */
function extractAtomLink(entryXml: string, feedUrl: string): string | null {
  // Find all <link> tags
  const linkRegex = /<link\s[^>]*?>/gi;
  const links = entryXml.match(linkRegex) || [];
  let alternateHref: string | null = null;
  let firstHref: string | null = null;

  for (const linkTag of links) {
    const hrefMatch = linkTag.match(/href\s*=\s*"([^"]*)"/i)
      || linkTag.match(/href\s*=\s*'([^']*)'/i);
    if (!hrefMatch) continue;
    const href = hrefMatch[1];

    const relMatch = linkTag.match(/rel\s*=\s*"([^"]*)"/i)
      || linkTag.match(/rel\s*=\s*'([^']*)'/i);
    const rel = relMatch ? relMatch[1] : 'alternate';

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
function extractAtomImage(entryXml: string, feedUrl: string): string | null {
  // media:thumbnail
  const mediaThumbnailUrl = getTagAttribute(entryXml, 'media:thumbnail', 'url');
  if (mediaThumbnailUrl) return resolveUrl(mediaThumbnailUrl, feedUrl);

  // media:content
  const mediaContentUrl = getTagAttribute(entryXml, 'media:content', 'url');
  if (mediaContentUrl) {
    const medium = getTagAttribute(entryXml, 'media:content', 'medium');
    const type = getTagAttribute(entryXml, 'media:content', 'type');
    if (medium === 'image' || type?.startsWith('image/')) {
      return resolveUrl(mediaContentUrl, feedUrl);
    }
  }

  return null;
}

/**
 * Parse an RSS 2.0 <item> into a CollectedArticle.
 */
function parseRssItem(
  itemXml: string,
  sourceName: string,
  feedUrl: string
): CollectedArticle | null {
  const title = getTagContent(itemXml, 'title');
  const link = getTagContent(itemXml, 'link');

  if (!title || !link) return null;

  const resolvedLink = resolveUrl(stripHtml(link), feedUrl);
  if (!resolvedLink) return null;

  // pubDate
  const pubDateRaw = getTagContent(itemXml, 'pubDate')
    || getTagContent(itemXml, 'dc:date');
  let publishedAt: string;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  // Content
  const rawContent = getTagContent(itemXml, 'content:encoded')
    || getTagContent(itemXml, 'description');
  const contentSnippet = rawContent
    ? truncate(stripHtml(rawContent), 500)
    : null;

  // Author
  const author = getTagContent(itemXml, 'dc:creator')
    || getTagContent(itemXml, 'author')
    || getTagContent(itemXml, 'creator');

  // Image
  const imageUrl = extractRssImage(itemXml, feedUrl);

  return {
    url: resolvedLink,
    title: stripHtml(title).trim(),
    sourceType: 'rss',
    sourceName,
    author: author ? stripHtml(author) : null,
    publishedAt,
    contentSnippet,
    imageUrl,
  };
}

/**
 * Parse an Atom <entry> into a CollectedArticle.
 */
function parseAtomEntry(
  entryXml: string,
  sourceName: string,
  feedUrl: string
): CollectedArticle | null {
  const title = getTagContent(entryXml, 'title');
  if (!title) return null;

  const link = extractAtomLink(entryXml, feedUrl);
  if (!link) return null;

  // Date
  const pubDateRaw = getTagContent(entryXml, 'published')
    || getTagContent(entryXml, 'updated');
  let publishedAt: string;
  if (pubDateRaw) {
    const parsed = new Date(pubDateRaw);
    publishedAt = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  } else {
    publishedAt = new Date().toISOString();
  }

  // Content
  const rawContent = getTagContent(entryXml, 'content')
    || getTagContent(entryXml, 'summary');
  const contentSnippet = rawContent
    ? truncate(stripHtml(rawContent), 500)
    : null;

  // Author — nested <author><name>
  const authorBlock = getTagContent(entryXml, 'author');
  const author = authorBlock ? getTagContent(authorBlock, 'name') : null;

  // Image
  const imageUrl = extractAtomImage(entryXml, feedUrl);

  return {
    url: link,
    title: stripHtml(title).trim(),
    sourceType: 'rss',
    sourceName,
    author: author ? stripHtml(author) : null,
    publishedAt,
    contentSnippet,
    imageUrl,
  };
}

/**
 * RSS/Atom feed collector implementing the Collector interface.
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
        console.error(`[RSS] HTTP ${response.status} fetching ${feedUrl}`);
        return [];
      }

      const xml = await response.text();
      if (!xml.trim()) {
        console.error(`[RSS] Empty response from ${feedUrl}`);
        return [];
      }

      const format = detectFormat(xml);
      if (!format) {
        console.error(`[RSS] Unknown feed format for ${feedUrl}`);
        return [];
      }

      const articles: CollectedArticle[] = [];

      if (format === 'atom') {
        const entries = splitByTag(xml, 'entry');
        for (const entry of entries) {
          try {
            const article = parseAtomEntry(entry, config.name, feedUrl);
            if (article) articles.push(article);
          } catch (err) {
            console.error(`[RSS] Error parsing Atom entry from ${feedUrl}:`, err);
          }
        }
      } else {
        const items = splitByTag(xml, 'item');
        for (const item of items) {
          try {
            const article = parseRssItem(item, config.name, feedUrl);
            if (article) articles.push(article);
          } catch (err) {
            console.error(`[RSS] Error parsing RSS item from ${feedUrl}:`, err);
          }
        }
      }

      console.log(`[RSS] Collected ${articles.length} articles from ${config.name} (${feedUrl})`);
      return articles;
    } catch (err) {
      console.error(`[RSS] Error collecting from ${config.name} (${feedUrl}):`, err);
      return [];
    }
  }
}

/** Default singleton instance for convenience. */
export const rssCollector = new RssCollector();
