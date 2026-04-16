import { COMPETITOR_BUDGET } from '../analytics/budgets';

/**
 * Fetch a competitor's homepage and extract headline items from the HTML.
 *
 * This is a best-effort content-extraction pass, not a full scraper. We
 * look for common patterns — <h1>/<h2>/<h3> tags, <a> tags with
 * href + text, and <article>/<li> blocks — and collect them as items.
 * The goal is to give Phase 2's consolidation AI a list of "what topics
 * is this competitor covering this week" with enough signal for
 * content-gap analysis, NOT to reproduce their full page.
 *
 * RSS feeds, when available, provide cleaner structured data. When a
 * competitor has an rssUrl, we fetch that instead of scraping the
 * homepage.
 */

export interface CompetitorItem {
  title: string;
  url: string | null;
}

export interface CompetitorFetchResult {
  items: CompetitorItem[];
  homepageHtmlHash: string | null;
  fetchedHomepage: boolean;
  fetchedRss: boolean;
  errors: string[];
}

export async function fetchCompetitorContent(
  homepageUrl: string,
  rssUrl: string | null
): Promise<CompetitorFetchResult> {
  const errors: string[] = [];
  let items: CompetitorItem[] = [];
  let homepageHtmlHash: string | null = null;
  let fetchedHomepage = false;
  let fetchedRss = false;

  // Prefer RSS when available — structured data beats scraping.
  if (rssUrl) {
    try {
      const rssItems = await fetchRssItems(rssUrl);
      items = rssItems;
      fetchedRss = true;
    } catch (err) {
      errors.push(
        `RSS fetch failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  // Fall back to homepage scraping if RSS unavailable or failed, or
  // always fetch homepage for the HTML hash (used for change detection).
  try {
    const result = await fetchHomepageItems(homepageUrl);
    homepageHtmlHash = result.htmlHash;
    fetchedHomepage = true;
    if (items.length === 0) {
      items = result.items;
    }
  } catch (err) {
    errors.push(
      `Homepage fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Cap items to prevent bloated KV blobs.
  items = items.slice(0, COMPETITOR_BUDGET.maxItemsPerCompetitor);

  return { items, homepageHtmlHash, fetchedHomepage, fetchedRss, errors };
}

async function fetchRssItems(rssUrl: string): Promise<CompetitorItem[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMPETITOR_BUDGET.fetchTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(rssUrl, {
      headers: { 'User-Agent': 'AgenticAIAccounting/1.0 (+https://agenticaiaccounting.com)' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`RSS ${response.status} from ${rssUrl}`);
  }

  const text = await response.text();
  return parseRssItems(text);
}

/**
 * Minimal RSS/Atom parser. Extracts <item>/<entry> title + link pairs.
 * Does NOT use DOMParser for full XML parsing — we just need title/link
 * from well-formed feeds, and regex is cheaper on Workers CPU time.
 *
 * Exported for direct unit testing.
 */
export function parseRssItems(xml: string): CompetitorItem[] {
  const items: CompetitorItem[] = [];

  // RSS 2.0: <item> blocks with <title> and <link>
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;
  while ((match = rssItemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = extractTag(block, 'title');
    const link = extractTag(block, 'link');
    if (title) {
      items.push({ title: decodeXmlEntities(title), url: link || null });
    }
  }

  // Atom: <entry> blocks with <title> and <link href="...">
  if (items.length === 0) {
    const atomEntryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = atomEntryRegex.exec(xml)) !== null) {
      const block = match[1];
      const title = extractTag(block, 'title');
      const linkHref = extractAtomLink(block);
      if (title) {
        items.push({ title: decodeXmlEntities(title), url: linkHref || null });
      }
    }
  }

  return items;
}

function extractTag(block: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(block);
  if (!match) return null;
  // Strip CDATA wrappers if present
  return match[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim();
}

function extractAtomLink(block: string): string | null {
  // Prefer rel="alternate", fall back to first <link href="...">
  const altMatch = /href="([^"]+)"[^>]*rel="alternate"/i.exec(block)
    || /rel="alternate"[^>]*href="([^"]+)"/i.exec(block);
  if (altMatch) return altMatch[1];
  const anyHref = /<link[^>]+href="([^"]+)"/i.exec(block);
  return anyHref ? anyHref[1] : null;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function fetchHomepageItems(
  homepageUrl: string
): Promise<{ items: CompetitorItem[]; htmlHash: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    COMPETITOR_BUDGET.fetchTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(homepageUrl, {
      headers: {
        'User-Agent': 'AgenticAIAccounting/1.0 (+https://agenticaiaccounting.com)',
        Accept: 'text/html',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Homepage ${response.status} from ${homepageUrl}`);
  }

  const html = await response.text();
  const htmlHash = await hashString(html);
  const items = extractHeadlineItems(html, homepageUrl);
  return { items, htmlHash };
}

/**
 * Extract headline-like items from raw HTML. Looks for heading tags and
 * their nearest parent link. This is intentionally coarse — the goal is
 * "what topics does this page surface" not "reproduce the page."
 *
 * Exported for direct unit testing.
 */
export function extractHeadlineItems(
  html: string,
  baseUrl: string
): CompetitorItem[] {
  const items: CompetitorItem[] = [];
  const seen = new Set<string>();

  // Match headings (h1-h3) that are either inside an <a> tag or standalone.
  // Pattern: <a href="URL">...<h2>TITLE</h2>...</a> or <h2><a href="URL">TITLE</a></h2>
  const headingRegex = /<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(html)) !== null) {
    const inner = match[1];
    const text = stripHtml(inner).trim();
    if (!text || text.length < 5 || text.length > 500) continue;

    // Try to find a link within or around the heading
    const linkMatch = /href="([^"]+)"/i.exec(inner);
    let url: string | null = null;
    if (linkMatch) {
      url = resolveUrl(linkMatch[1], baseUrl);
    } else {
      // Check the 200 chars before this heading for a wrapping <a>
      const beforeHeading = html.slice(Math.max(0, match.index - 200), match.index);
      const wrappingLink = /<a[^>]+href="([^"]+)"[^>]*>\s*$/i.exec(beforeHeading);
      if (wrappingLink) {
        url = resolveUrl(wrappingLink[1], baseUrl);
      }
    }

    const dedupeKey = text.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      items.push({ title: text, url });
    }
  }

  return items;
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
}

function resolveUrl(href: string, baseUrl: string): string | null {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) {
    return null;
  }
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

async function hashString(s: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(s);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
