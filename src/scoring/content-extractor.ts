/**
 * Article content extraction for enriching articles before scoring.
 *
 * Fetches an article URL, strips HTML, and returns up to 3000 characters
 * of cleaned text content. Designed for use in Cloudflare Workers (Web APIs only).
 */

const MAX_CONTENT_LENGTH = 3000;
const FETCH_TIMEOUT_MS = 5000;

/**
 * Try to extract content from semantic main-content elements.
 * Falls back to the full HTML if no semantic container is found.
 *
 * Checks elements in priority order: <article>, <main>, common content divs.
 * Exported for testing.
 */
export function extractMainContent(html: string): string {
  const selectors: RegExp[] = [
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<div\s[^>]*class=["'][^"']*post-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\s[^>]*class=["'][^"']*article-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\s[^>]*class=["'][^"']*entry-content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\s[^>]*class=["'][^"']*post-body[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div\s[^>]*role=["']main["'][^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const regex of selectors) {
    const match = regex.exec(html);
    if (match && match[1]) {
      return match[1];
    }
  }

  // No semantic container found — use the full HTML
  return html;
}

/**
 * Extract a meta description from HTML, if present.
 */
function extractMetaDescription(html: string): string | null {
  const match = /<meta\s[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i.exec(html);
  if (match && match[1]) {
    return match[1].trim();
  }
  // Also try the reversed attribute order (content before name)
  const match2 = /<meta\s[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i.exec(html);
  if (match2 && match2[1]) {
    return match2[1].trim();
  }
  return null;
}

/**
 * Fetch an article URL and extract the main text content.
 *
 * @param url - The article URL to fetch
 * @returns Up to 3000 characters of cleaned text, or null on any error
 */
export async function extractContent(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AgenticAIAccounting/1.0 (content-extractor)',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    const html = await response.text();
    if (!html || html.length === 0) {
      return null;
    }

    // Extract main content area first, then strip HTML
    const mainContent = extractMainContent(html);
    let text = stripHtml(mainContent);

    if (!text || text.trim().length === 0) {
      return null;
    }

    // If the extracted text is very short, try meta description fallback
    if (text.trim().length < 100) {
      const metaDesc = extractMetaDescription(html);
      if (metaDesc) {
        text = metaDesc + ' ' + text.trim();
      }
    }

    const trimmed = text.trim();
    if (trimmed.length <= MAX_CONTENT_LENGTH) {
      return trimmed;
    }
    return trimmed.slice(0, MAX_CONTENT_LENGTH);
  } catch {
    // Return null on any error — don't throw
    return null;
  }
}

/**
 * Strip HTML tags, scripts, styles, and navigation elements from HTML content.
 * Returns cleaned plain text.
 *
 * Exported for testing.
 */
export function stripHtml(html: string): string {
  let text = html;

  // Remove script tags and their content
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');

  // Remove style tags and their content
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');

  // Remove nav, header, footer elements and their content
  text = text.replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, ' ');
  text = text.replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, ' ');
  text = text.replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, ' ');

  // Remove aside, form, button, iframe, noscript elements
  text = text.replace(/<aside\b[^>]*>[\s\S]*?<\/aside>/gi, ' ');
  text = text.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, ' ');
  text = text.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, ' ');
  text = text.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, ' ');
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');

  // Remove SVG content
  text = text.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&#\d+;/g, ' ');
  text = text.replace(/&[a-zA-Z]+;/g, ' ');

  // Collapse whitespace: newlines, tabs, multiple spaces
  text = text.replace(/\s+/g, ' ');

  return text.trim();
}
