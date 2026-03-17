import type { Article } from '../types';

/**
 * Escape special XML characters to prevent malformed output.
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Convert an ISO 8601 date string to RFC 822 format as required by RSS 2.0.
 * Example output: "Mon, 15 Mar 2026 14:30:00 GMT"
 */
function toRfc822(isoDate: string): string {
  const date = new Date(isoDate);
  if (isNaN(date.getTime())) {
    return new Date().toUTCString();
  }
  return date.toUTCString();
}

/**
 * Map a source type to a human-readable source label for the <source> element.
 */
function sourceLabel(sourceName: string): string {
  return escapeXml(sourceName);
}

/**
 * Generate a single RSS <item> element for an article.
 */
function renderItem(article: Article): string {
  const title = escapeXml(article.headline || article.title);
  const link = escapeXml(article.url);
  const guid = escapeXml(article.url);
  const description = article.aiSummary
    ? escapeXml(article.aiSummary)
    : article.contentSnippet
      ? escapeXml(article.contentSnippet)
      : '';
  const pubDate = toRfc822(article.publishedAt);
  const source = sourceLabel(article.sourceName);

  const categoryTags = article.tags
    .map((tag) => `      <category>${escapeXml(tag)}</category>`)
    .join('\n');

  const authorTag = article.author
    ? `      <author>${escapeXml(article.author)}</author>\n`
    : '';

  const qualityTag = article.qualityScore != null
    ? `      <agenticai:quality>${article.qualityScore}</agenticai:quality>\n`
    : '';

  return `    <item>
      <title>${title}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${guid}</guid>
      <description>${description}</description>
      <pubDate>${pubDate}</pubDate>
      <source url="https://agenticaiaccounting.com">${source}</source>
${authorTag}${categoryTags ? categoryTags + '\n' : ''}${qualityTag}    </item>`;
}

/**
 * Generate a valid RSS 2.0 XML feed from an array of articles.
 *
 * Articles are sorted by publishedAt descending (newest first).
 * Only published articles with a relevance score >= 50 should be passed in,
 * but this function does not filter — the caller is responsible for filtering.
 *
 * @param articles - Array of Article objects to include in the feed
 * @returns A complete RSS 2.0 XML string
 */
export function generateRssFeed(articles: Article[]): string {
  // Sort articles by publishedAt descending (newest first)
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const lastBuildDate = sorted.length > 0
    ? toRfc822(sorted[0].publishedAt)
    : toRfc822(new Date().toISOString());

  const items = sorted.map(renderItem).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:agenticai="https://agenticaiaccounting.com/ns">
  <channel>
    <title>Agentic AI Accounting</title>
    <link>https://agenticaiaccounting.com</link>
    <description>The latest on AI agents in accounting, bookkeeping, audit, and tax</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="https://agenticaiaccounting.com/feed.xml" rel="self" type="application/rss+xml" />
    <ttl>60</ttl>
${items}
  </channel>
</rss>`;
}
