import type { Collector, CollectedArticle, SourceConfig } from '../types';

/**
 * Y Combinator collector for accounting/fintech/AI companies.
 *
 * Two data sources:
 * 1. YC's public company directory API (https://api.ycombinator.com/v0.1/companies)
 *    filtered for accounting, fintech, and AI companies.
 * 2. HN "Launch HN" and "Show HN" posts about accounting/AI tools via Algolia search.
 *
 * Source type: 'hn' (closest existing type in the SourceType union)
 */

const YC_COMPANIES_URL = 'https://api.ycombinator.com/v0.1/companies';
const HN_SEARCH_URL = 'https://hn.algolia.com/api/v1/search';

/** Shape of a YC company from the directory API. */
interface YCCompany {
  id: number;
  name: string;
  slug: string;
  url: string;
  batch: string;
  status: string;
  industries: string[];
  regions: string[];
  locations: string[];
  long_description: string;
  one_liner: string;
  team_size: number;
  highlight_black: boolean;
  highlight_latinx: boolean;
  highlight_women: boolean;
  top_company: boolean;
  isHiring: boolean;
  nonprofit: boolean;
  demo_day_video_public: string | null;
  launch_hn: string | null;
  website: string;
}

interface YCCompaniesResponse {
  companies: YCCompany[];
  page: number;
  totalPages: number;
  count: number;
}

/** Shape of an Algolia HN search hit. */
interface HNHit {
  objectID: string;
  title: string | null;
  url: string | null;
  author: string | null;
  created_at: string | null;
  story_text: string | null;
  points: number | null;
  num_comments: number | null;
  _tags?: string[];
}

interface HNSearchResponse {
  hits: HNHit[];
  nbHits: number;
  page: number;
  nbPages: number;
  hitsPerPage: number;
}

/** Keywords for YC company directory queries. */
const YC_QUERY_TERMS = [
  'accounting',
  'bookkeeping',
  'tax',
  'audit',
  'fintech',
  'financial automation',
];

/** HN search queries for Launch HN / Show HN posts. */
const HN_QUERIES = [
  'Launch HN accounting',
  'Launch HN bookkeeping',
  'Launch HN tax',
  'Show HN accounting AI',
  'Show HN bookkeeping',
  'Show HN fintech',
];

/** Truncate a string to maxLen characters. */
function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3).trimEnd() + '...';
}

/**
 * Build numeric filter for "last 7 days" on Algolia HN API.
 * YC launches are less frequent than regular news, so we look back 7 days.
 */
function last7dFilter(): string {
  const now = Math.floor(Date.now() / 1000);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60;
  return `created_at_i>${sevenDaysAgo}`;
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

/**
 * Fetch YC companies from their directory API for a given query term.
 * The API supports a `q` parameter for full-text search.
 */
async function fetchYCCompanies(query: string): Promise<YCCompany[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      page: '1',
    });

    const response = await fetch(`${YC_COMPANIES_URL}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'AgenticAIAccounting/1.0 (news aggregator)',
      },
    });

    if (!response.ok) {
      console.error(`[YC] Companies API returned ${response.status} for query "${query}"`);
      return [];
    }

    const data = (await response.json()) as YCCompaniesResponse;
    return data.companies || [];
  } catch (err) {
    console.error(`[YC] Error fetching companies for "${query}":`, err);
    return [];
  }
}

/**
 * Convert a YC company listing into a CollectedArticle.
 * Uses the company's YC page as the URL.
 */
function companyToArticle(company: YCCompany, sourceName: string): CollectedArticle {
  const ycUrl = `https://www.ycombinator.com/companies/${company.slug}`;
  const snippet = company.one_liner
    ? truncate(company.one_liner, 500)
    : company.long_description
      ? truncate(company.long_description, 500)
      : null;

  return {
    url: company.website || ycUrl,
    title: `${company.name} (YC ${company.batch}) — ${company.one_liner || 'YC Company'}`,
    sourceType: 'hn',
    sourceName,
    author: null,
    publishedAt: new Date().toISOString(),
    contentSnippet: snippet,
    imageUrl: null,
  };
}

/**
 * Fetch HN "Launch HN" / "Show HN" posts from the Algolia API.
 */
async function fetchHNLaunches(query: string): Promise<HNHit[]> {
  try {
    const params = new URLSearchParams({
      query,
      tags: 'story',
      numericFilters: last7dFilter(),
      hitsPerPage: '20',
    });

    const response = await fetch(`${HN_SEARCH_URL}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(`[YC] HN search returned ${response.status} for query "${query}"`);
      return [];
    }

    const data = (await response.json()) as HNSearchResponse;
    return data.hits || [];
  } catch (err) {
    console.error(`[YC] Error fetching HN launches for "${query}":`, err);
    return [];
  }
}

/**
 * Convert an HN hit to a CollectedArticle.
 */
function hitToArticle(hit: HNHit, sourceName: string): CollectedArticle | null {
  if (!hit.title) return null;

  const articleUrl = hit.url || `https://news.ycombinator.com/item?id=${hit.objectID}`;
  const snippet = hit.story_text ? truncate(hit.story_text, 500) : null;

  return {
    url: articleUrl,
    title: hit.title,
    sourceType: 'hn',
    sourceName,
    author: hit.author ?? null,
    publishedAt: hit.created_at ?? new Date().toISOString(),
    contentSnippet: snippet,
    imageUrl: null,
  };
}

export const ycombinatorCollector: Collector = {
  async collect(config: SourceConfig): Promise<CollectedArticle[]> {
    try {
      const seenUrls = new Set<string>();
      const articles: CollectedArticle[] = [];

      // Custom query terms from config or defaults
      const companyQueryStr = config.config['companyQueries'] || '';
      const companyQueries = companyQueryStr
        ? companyQueryStr.split(',').map((q) => q.trim()).filter((q) => q.length > 0)
        : YC_QUERY_TERMS;

      const hnQueryStr = config.config['hnQueries'] || '';
      const hnQueries = hnQueryStr
        ? hnQueryStr.split(',').map((q) => q.trim()).filter((q) => q.length > 0)
        : HN_QUERIES;

      // 1. Fetch YC company listings (limit to 3 queries to stay within subrequest budget)
      const limitedCompanyQueries = companyQueries.slice(0, 3);
      const companyResults = await Promise.all(
        limitedCompanyQueries.map(fetchYCCompanies)
      );

      for (const companies of companyResults) {
        for (const company of companies) {
          // Only include active companies
          if (company.status === 'Inactive') continue;

          const article = companyToArticle(company, config.name);
          const normalized = normalizeUrl(article.url);

          if (!seenUrls.has(normalized)) {
            seenUrls.add(normalized);
            articles.push(article);
          }
        }
      }

      // 2. Fetch HN Launch/Show posts (limit to 4 queries)
      const limitedHnQueries = hnQueries.slice(0, 4);
      const hnResults = await Promise.all(
        limitedHnQueries.map(fetchHNLaunches)
      );

      for (const hits of hnResults) {
        for (const hit of hits) {
          const article = hitToArticle(hit, config.name);
          if (!article) continue;

          const normalized = normalizeUrl(article.url);
          if (!seenUrls.has(normalized)) {
            seenUrls.add(normalized);
            articles.push(article);
          }
        }
      }

      console.log(
        `[YC] Collected ${articles.length} unique articles from ${limitedCompanyQueries.length} company queries and ${limitedHnQueries.length} HN queries`
      );

      return articles;
    } catch (err) {
      console.error('[YC] Unexpected error:', err);
      return [];
    }
  },
};
