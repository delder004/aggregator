/**
 * Company enricher — probes the web to discover website URLs,
 * blog RSS feeds, and job board integrations for newly discovered companies.
 */

/** Maximum number of new companies to enrich per workflow run. */
export const MAX_ENRICHMENTS_PER_RUN = 5;

const FETCH_TIMEOUT = 5000;
const USER_AGENT = 'AgenticAIAccounting/1.0 (enricher)';

// ─── Slug Generation ───

/** Generate URL-friendly slugs from a company name. */
export function generateSlugs(companyName: string): string[] {
  const condensed = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  const hyphenated = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const slugs = [condensed];
  if (hyphenated !== condensed) slugs.push(hyphenated);
  return slugs;
}

// ─── Website Probing ───

const DOMAIN_SUFFIXES = ['.com', '.ai', '.io', '.co'];

/** Try to find a working website for a company. Returns URL or null. */
export async function probeWebsite(
  companyName: string,
  hintDomain?: string
): Promise<string | null> {
  // If classifier provided a domain hint, try it first
  if (hintDomain) {
    const url = hintDomain.startsWith('http')
      ? hintDomain
      : `https://${hintDomain}`;
    if (await isUrlReachable(url)) return url;
  }

  const slugs = generateSlugs(companyName);
  for (const slug of slugs) {
    for (const suffix of DOMAIN_SUFFIXES) {
      const url = `https://${slug}${suffix}`;
      if (await isUrlReachable(url)) return url;
    }
  }
  return null;
}

async function isUrlReachable(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Blog RSS Discovery ───

export interface BlogDiscoveryResult {
  type: 'rss' | 'scraper' | null;
  feedUrl?: string;
  blogUrl?: string;
}

const RSS_PROBE_PATHS = [
  '/feed',
  '/feed.xml',
  '/blog/feed',
  '/blog/rss.xml',
  '/rss',
  '/blog/feed.xml',
  '/rss.xml',
];

/** Discover a blog RSS feed or blog page for a given website URL. */
export async function discoverBlog(
  websiteUrl: string
): Promise<BlogDiscoveryResult> {
  // Step 1: Fetch homepage and look for <link rel="alternate" ...>
  try {
    const res = await fetch(websiteUrl, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
    });
    if (res.ok) {
      const html = await res.text();
      const feedUrl = extractRssLinkFromHtml(html, websiteUrl);
      if (feedUrl) return { type: 'rss', feedUrl };
    }
  } catch {
    /* continue to probing */
  }

  // Step 2: Probe common RSS paths
  const baseUrl = websiteUrl.replace(/\/$/, '');
  for (const path of RSS_PROBE_PATHS) {
    const url = `${baseUrl}${path}`;
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
        headers: { 'User-Agent': USER_AGENT },
      });
      if (res.ok) {
        const ct = res.headers.get('content-type') || '';
        if (
          ct.includes('xml') ||
          ct.includes('rss') ||
          ct.includes('atom')
        ) {
          return { type: 'rss', feedUrl: url };
        }
      }
    } catch {
      /* continue */
    }
  }

  // Step 3: Check if /blog exists (for blog scraper fallback)
  try {
    const blogUrl = `${baseUrl}/blog`;
    const res = await fetch(blogUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(3000),
      headers: { 'User-Agent': USER_AGENT },
    });
    if (res.ok) {
      return { type: 'scraper', blogUrl };
    }
  } catch {
    /* no blog path */
  }

  return { type: null };
}

/** Extract RSS/Atom feed URL from HTML <link> tags. */
export function extractRssLinkFromHtml(
  html: string,
  baseUrl: string
): string | null {
  const linkRegex = /<link\s[^>]*rel=["']alternate["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    const tag = match[0];
    if (
      /type=["'](application\/rss\+xml|application\/atom\+xml)["']/i.test(tag)
    ) {
      const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
      if (hrefMatch) {
        try {
          return new URL(hrefMatch[1], baseUrl).href;
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

// ─── Job Board Probing ───

export interface JobBoardResult {
  type: 'greenhouse' | 'lever' | 'ashby';
  token: string;
}

/** Probe Greenhouse, Lever, and Ashby for a company's job board. */
export async function probeJobBoards(
  companyName: string
): Promise<JobBoardResult | null> {
  const slugs = generateSlugs(companyName);

  for (const slug of slugs) {
    // Greenhouse
    try {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=false`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );
      if (res.ok) {
        const data = (await res.json()) as { jobs?: unknown[] };
        if (data.jobs && data.jobs.length > 0) {
          return { type: 'greenhouse', token: slug };
        }
      }
    } catch {
      /* continue */
    }

    // Lever
    try {
      const res = await fetch(
        `https://api.lever.co/v0/postings/${slug}?mode=json`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );
      if (res.ok) {
        const data = (await res.json()) as unknown[];
        if (Array.isArray(data) && data.length > 0) {
          return { type: 'lever', token: slug };
        }
      }
    } catch {
      /* continue */
    }

    // Ashby
    try {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${slug}`,
        { signal: AbortSignal.timeout(FETCH_TIMEOUT) }
      );
      if (res.ok) {
        const data = (await res.json()) as { jobs?: unknown[] };
        if (data.jobs && data.jobs.length > 0) {
          return { type: 'ashby', token: slug };
        }
      }
    } catch {
      /* continue */
    }
  }

  return null;
}

// ─── Generic Name Filter ───

const GENERIC_WORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'are', 'was', 'were',
  'will', 'have', 'has', 'been', 'their', 'its', 'our', 'your', 'not', 'but',
  'can', 'all', 'one', 'new', 'more', 'how', 'who', 'what', 'when', 'where',
  'why', 'may', 'also', 'just', 'like', 'well', 'very', 'much', 'most',
  // Common generic business/tech words
  'ai', 'cloud', 'data', 'tech', 'digital', 'global', 'smart', 'next', 'open',
  'first', 'best', 'top', 'key', 'big', 'now', 'pro', 'fast', 'true',
]);

/** Check if a name is too generic/short to be a meaningful company name. */
export function isGenericName(name: string): boolean {
  if (name.length <= 2) return true;
  const lower = name.toLowerCase();
  if (GENERIC_WORDS.has(lower)) return true;
  // Single word <= 3 chars is too ambiguous
  if (!name.includes(' ') && name.length <= 3) return true;
  return false;
}
