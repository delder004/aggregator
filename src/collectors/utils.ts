/**
 * Shared utility functions for collectors.
 *
 * Contains title sanitization and HTML entity decoding used by
 * multiple collector modules (RSS, blog scraper, etc.).
 */

/**
 * Decode common HTML entities and numeric character references.
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCharCode(parseInt(dec, 10))
    )
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/** Regex matching leading date patterns in titles (full and abbreviated month names) */
const LEADING_DATE_RE =
  /^((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2},?\s+\d{4})\s*/i;

/**
 * Extract a leading date from raw title text, if present.
 * Returns the parsed ISO string, or null if no date found.
 */
export function extractLeadingDate(raw: string): string | null {
  const m = LEADING_DATE_RE.exec(raw);
  if (!m) return null;
  const parsed = new Date(m[1]);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Sanitize an article title by stripping common junk prefixes/suffixes,
 * decoding HTML entities, and truncating to a reasonable length.
 *
 * Handles patterns like:
 *  - Leading "Article" prefix
 *  - Leading date patterns ("March 01, 2026Some title")
 *  - Leading category tags ("CompanyTitle", "ProductTitle")
 *  - Trailing author/role suffixes joined without space ("CampfireTeam")
 *  - HTML entities
 *  - Long titles truncated at sentence boundary, with hard cutoff fallback
 */
export function sanitizeTitle(raw: string): string {
  if (!raw) return '';

  let title = raw.trim();

  // Decode HTML entities
  title = decodeHtmlEntities(title);

  // Strip leading "Article" prefix — handles both "Article How..." and
  // concatenated "ArticleAI..." (no space/word-boundary between them)
  title = title.replace(/^Article(?=\s|[A-Z])\s*/i, '');

  // Strip leading date patterns (full and abbreviated month names)
  title = title.replace(LEADING_DATE_RE, '');

  // Strip leading category tags concatenated without space
  // e.g., "CompanyBasis Raises..." → "Basis Raises..."
  title = title.replace(
    /^(?:Company|Product|Partnership|Feature|Update|News|Press|Event|Announcement)(?=[A-Z])/i,
    ''
  );

  // Collapse whitespace
  title = title.replace(/\s+/g, ' ').trim();

  // Strip trailing role/team suffixes that are directly joined to a word
  // (no space before the suffix). "CampfireTeam" -> "Campfire" but
  // "AI for Your Team" stays unchanged.
  title = title
    .replace(/(\S)(?:Team|Staff|Editor|Admin|Blog)$/i, '$1')
    .trim();

  // Truncate at the first natural sentence boundary if title is > 120 chars
  if (title.length > 120) {
    const breakPoints = [
      title.indexOf('. ', 40),
      title.indexOf(' — ', 40),
      title.indexOf(': ', 40),
    ].filter((i) => i > 0);

    if (breakPoints.length > 0) {
      const breakAt = Math.min(...breakPoints);
      title = title.slice(0, breakAt + 1);
    } else {
      title = title.slice(0, 117) + '...';
    }
  }

  return title;
}
