import type { Collector, CollectedArticle, SourceConfig } from '../types';

const ARXIV_API_BASE = 'https://export.arxiv.org/api/query';
const RATE_LIMIT_DELAY_MS = 3000;
const MAX_RESULTS = 50;

/**
 * Delay execution for the specified number of milliseconds.
 * Used to respect arXiv's rate limit of 3 seconds between requests.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Truncate a string to the specified max length, appending an ellipsis if truncated.
 */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3).trimEnd() + '...';
}

/**
 * Clean up text from arXiv XML: strip tags, decode XML entities,
 * collapse whitespace, and trim.
 */
function cleanText(text: string): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Format multiple authors into a readable string.
 * - 1 author: "Alice Smith"
 * - 2 authors: "Alice Smith & Bob Jones"
 * - 3+ authors: "Alice Smith, Bob Jones & N others"
 */
function formatAuthors(authors: string[]): string {
  if (authors.length === 0) return 'Unknown';
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  const othersCount = authors.length - 2;
  return `${authors[0]}, ${authors[1]} & ${othersCount} other${othersCount > 1 ? 's' : ''}`;
}

/**
 * Extract the text content of the first occurrence of a given XML tag
 * within a block of XML text. Handles self-closing tags as empty.
 *
 * Uses a non-greedy match to get the inner content between open and close tags.
 */
function extractTagContent(xml: string, tagName: string): string | null {
  // Match both namespaced and non-namespaced tags.
  // arXiv Atom feeds may use tags like <title>, <summary>, <published>, <name>, etc.
  // The feed does NOT typically use namespace prefixes on standard Atom elements.
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    'i'
  );
  const match = xml.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract all occurrences of a given XML tag's content blocks from XML text.
 * Returns the full inner content of each matched block.
 */
function extractAllTagBlocks(xml: string, tagName: string): string[] {
  const pattern = new RegExp(
    `<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`,
    'gi'
  );
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    results.push(match[1]);
  }
  return results;
}

/**
 * Extract an attribute value from an XML tag string.
 */
function extractAttribute(tag: string, attrName: string): string | null {
  const pattern = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const match = tag.match(pattern);
  return match ? match[1] : null;
}

/**
 * Extract all <link> elements from an entry block and return their attributes.
 */
function extractLinks(
  entryXml: string
): Array<{ href: string; rel: string | null; title: string | null }> {
  const linkPattern = /<link\s([^>]*?)\/?\s*>/gi;
  const links: Array<{ href: string; rel: string | null; title: string | null }> = [];
  let match: RegExpExecArray | null;
  while ((match = linkPattern.exec(entryXml)) !== null) {
    const attrs = match[1];
    const href = extractAttribute(attrs, 'href');
    if (href) {
      links.push({
        href,
        rel: extractAttribute(attrs, 'rel'),
        title: extractAttribute(attrs, 'title'),
      });
    }
  }
  return links;
}

/**
 * Split the arXiv Atom XML feed into individual <entry> blocks.
 */
function splitEntries(xml: string): string[] {
  const pattern = /<entry>([\s\S]*?)<\/entry>/gi;
  const entries: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    entries.push(match[1]);
  }
  return entries;
}

/**
 * Parse a single arXiv Atom entry block (the inner XML of <entry>)
 * into a CollectedArticle.
 */
function parseEntry(entryXml: string, sourceName: string): CollectedArticle | null {
  // Title
  const rawTitle = extractTagContent(entryXml, 'title');
  const title = cleanText(rawTitle || '');
  if (!title) return null;

  // URL — prefer non-PDF alternate link, fall back to <id>
  let url = '';
  const links = extractLinks(entryXml);
  for (const link of links) {
    // Skip PDF links
    if (link.title === 'pdf') continue;
    // Prefer alternate links
    if (link.rel === 'alternate' || !link.rel) {
      url = link.href;
      break;
    }
    // Fallback: any non-PDF link
    if (!url) {
      url = link.href;
    }
  }

  // If no link found, use <id> (which is typically the abstract URL)
  if (!url) {
    const id = extractTagContent(entryXml, 'id');
    url = id?.trim() || '';
  }

  if (!url) return null;

  // Normalize arXiv URLs: http → https
  url = url.replace(/^http:\/\/arxiv\.org/, 'https://arxiv.org');

  // Published date
  const published = extractTagContent(entryXml, 'published');
  const updated = extractTagContent(entryXml, 'updated');
  const publishedAt =
    published?.trim() || updated?.trim() || new Date().toISOString();

  // Authors — each <author> block contains a <name> element
  const authorBlocks = extractAllTagBlocks(entryXml, 'author');
  const authors: string[] = [];
  for (const block of authorBlocks) {
    const name = extractTagContent(block, 'name');
    if (name) {
      const cleaned = cleanText(name);
      if (cleaned) {
        authors.push(cleaned);
      }
    }
  }

  // Abstract/summary
  const rawSummary = extractTagContent(entryXml, 'summary');
  const abstract = cleanText(rawSummary || '');
  const contentSnippet = abstract ? truncate(abstract, 500) : null;

  return {
    url,
    title,
    sourceType: 'arxiv',
    sourceName,
    author: formatAuthors(authors),
    publishedAt,
    contentSnippet,
    imageUrl: null, // arXiv papers don't have thumbnails
  };
}

/**
 * Parse the full arXiv Atom feed XML response and extract articles.
 */
function parseArxivAtom(xml: string, sourceName: string): CollectedArticle[] {
  const entries = splitEntries(xml);
  const articles: CollectedArticle[] = [];

  for (let i = 0; i < entries.length; i++) {
    try {
      const article = parseEntry(entries[i], sourceName);
      if (article) {
        articles.push(article);
      }
    } catch (err) {
      console.error(`[arxiv] Error parsing entry ${i}:`, err);
      // Continue with remaining entries
    }
  }

  return articles;
}

/**
 * Build the arXiv API query URL from a SourceConfig.
 *
 * The SourceConfig.config should contain a `query` field with the arXiv
 * search query (e.g., 'cat:cs.AI AND (all:accounting OR all:audit)').
 *
 * Supports optional `maxResults` in config (defaults to 50).
 */
function buildQueryUrl(config: SourceConfig): string {
  const query = config.config['query'] || '';
  const maxResults = parseInt(
    config.config['maxResults'] || String(MAX_RESULTS),
    10
  );
  const sortBy = config.config['sortBy'] || 'submittedDate';
  const sortOrder = config.config['sortOrder'] || 'descending';

  const params = new URLSearchParams({
    search_query: query,
    start: '0',
    max_results: String(maxResults),
    sortBy,
    sortOrder,
  });

  return `${ARXIV_API_BASE}?${params.toString()}`;
}

/**
 * arXiv collector implementing the Collector interface.
 *
 * Uses the arXiv API (Atom feed at export.arxiv.org/api/query) to search
 * for papers in cs.AI related to accounting/finance terms.
 *
 * Respects arXiv's rate limit with a 3-second delay between requests.
 */
export const arxivCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    if (!config.isActive) {
      return [];
    }

    const query = config.config['query'];
    if (!query) {
      console.error(`[arxiv] No query configured for source "${config.name}"`);
      return [];
    }

    try {
      // Respect rate limit: delay before making the request.
      // This ensures we don't hammer arXiv if multiple queries are run sequentially.
      await delay(RATE_LIMIT_DELAY_MS);

      const url = buildQueryUrl(config);
      console.log(`[arxiv] Fetching: ${url}`);

      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'AgenticAIAccounting/1.0 (https://agenticaiaccounting.com)',
        },
      });

      if (!response.ok) {
        console.error(
          `[arxiv] HTTP error ${response.status} for source "${config.name}": ${response.statusText}`
        );
        return [];
      }

      const xml = await response.text();

      if (!xml || xml.trim().length === 0) {
        console.error(`[arxiv] Empty response for source "${config.name}"`);
        return [];
      }

      const articles = parseArxivAtom(xml, config.name);
      console.log(
        `[arxiv] Collected ${articles.length} articles from "${config.name}"`
      );

      return articles;
    } catch (err) {
      console.error(`[arxiv] Error collecting from "${config.name}":`, err);
      return [];
    }
  },
};

export default arxivCollector;
