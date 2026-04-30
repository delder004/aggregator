import type { Env } from '../types';
import { RANKINGS_BUDGET } from './budgets';
import { getWeeklyWindow, parseStrictIsoTimestamp } from './window';
import { upsertKeywordRanking } from './db';
import { DEFAULT_KEYWORDS } from './keywords';

/**
 * Serper.dev rankings sweep.
 *
 * For each keyword in the sweep list, queries Google via Serper and
 * records our site's rank in the top-10 organic results. Produces one
 * keyword_rankings row per (keyword, window_start).
 *
 * Window semantics:
 *   Rankings are a point-in-time snapshot, not a cumulative metric, so
 *   they are attributed to the CURRENT weekly window — "what our rankings
 *   looked like when we swept during week W." This differs from
 *   cf_analytics_snapshots and search_console_snapshots, which are
 *   attributed to the PREVIOUS complete week because they aggregate data
 *   FROM that week. Each namespace's window semantic is documented at
 *   its resolver.
 *
 * Idempotency: the UNIQUE(keyword, window_start) constraint on
 * keyword_rankings + the UPSERT in upsertKeywordRanking means running
 * the sweep twice in the same week overwrites the previous run's
 * values. Operators can re-trigger freely without creating duplicate
 * rows.
 *
 * Per-keyword failure isolation: every keyword runs in its own try/catch.
 * A network error on one keyword writes a null-rank row (so we have a
 * record we tried) and the sweep continues. Only a missing API key or
 * over-budget keyword list aborts the whole sweep.
 *
 * Budget: RANKINGS_BUDGET caps the keyword count at 30. Each keyword is
 * one Serper subrequest plus one D1 upsert. Worst-case 30 subrequests
 * per sweep.
 */

const SERPER_API_URL = 'https://google.serper.dev/search';
const DEFAULT_HOSTNAME = 'agenticaiccounting.com';

export interface RankingSweepOptions {
  keywords?: readonly string[];
  windowStart?: string;
  hostname?: string;
}

export interface RankingSweepRow {
  keyword: string;
  rank: number | null;
  urlRanked: string | null;
  failed: boolean;
}

export interface RankingSweepResult {
  windowStart: string;
  hostname: string;
  totalKeywords: number;
  rankedCount: number;
  unrankedCount: number;
  failedCount: number;
  rankings: RankingSweepRow[];
}

export async function runRankingsSweep(
  env: Env,
  options: RankingSweepOptions = {}
): Promise<RankingSweepResult> {
  if (!env.SERPER_API_KEY) {
    throw new Error('SERPER_API_KEY is required for the rankings sweep');
  }

  const keywords = options.keywords ?? DEFAULT_KEYWORDS;
  if (keywords.length === 0) {
    throw new Error('rankings sweep requires at least one keyword');
  }
  if (keywords.length > RANKINGS_BUDGET.maxKeywordsPerSweep) {
    throw new Error(
      `rankings sweep exceeds keyword budget: ${keywords.length} > ${RANKINGS_BUDGET.maxKeywordsPerSweep}`
    );
  }

  const hostname = options.hostname ?? env.SITE_HOSTNAME ?? DEFAULT_HOSTNAME;
  const windowStart = resolveRankingsWindow(options.windowStart);
  const apiKey = env.SERPER_API_KEY;

  const rankings = await Promise.all(
    keywords.map((keyword) => sweepOneKeyword(env, apiKey, keyword, hostname, windowStart))
  );

  // "ranked" = we appeared in results (url matched), regardless of whether
  // Serper also returned a numeric position. "unranked" = call succeeded
  // but our site was NOT in the organic results at all.
  const rankedCount = rankings.filter((r) => !r.failed && r.urlRanked !== null).length;
  const unrankedCount = rankings.filter((r) => !r.failed && r.urlRanked === null).length;
  const failedCount = rankings.filter((r) => r.failed).length;

  return {
    windowStart,
    hostname,
    totalKeywords: keywords.length,
    rankedCount,
    unrankedCount,
    failedCount,
    rankings,
  };
}

/**
 * Resolve the sweep window to the canonical Monday bucket.
 *
 * Rankings use the CURRENT weekly window (snapshot taken DURING this week).
 * Any override is normalized through getWeeklyWindow() so that an arbitrary
 * instant within a week always maps to its Monday 00:00 UTC — e.g.,
 * `?window=2026-04-08T00:00:00Z` (Wednesday) resolves to the Monday
 * `2026-04-06T00:00:00.000Z`. Without this, a manual trigger mid-week
 * would create a second set of (keyword, window_start) rows that shadow
 * the canonical Monday bucket instead of overwriting it.
 *
 * Exported for direct unit testing.
 */
export function resolveRankingsWindow(override?: string): string {
  if (override !== undefined) {
    const ms = parseStrictIsoTimestamp(override);
    if (ms === null) {
      throw new Error(
        `windowStart must be a strict ISO 8601 timestamp with an explicit Z or ±HH:MM offset (got ${override})`
      );
    }
    return getWeeklyWindow(new Date(ms)).windowStart;
  }
  return getWeeklyWindow().windowStart;
}

async function sweepOneKeyword(
  env: Env,
  apiKey: string,
  keyword: string,
  hostname: string,
  windowStart: string
): Promise<RankingSweepRow> {
  try {
    const serp = await fetchSerperResults(apiKey, keyword);
    const match = findOurRank(serp, hostname);
    await upsertKeywordRanking(env.DB, windowStart, {
      keyword,
      rank: match.rank,
      urlRanked: match.url,
      serpFeatures: serp.features,
      totalResults: serp.totalResults,
    });
    return {
      keyword,
      rank: match.rank,
      urlRanked: match.url,
      failed: false,
    };
  } catch (err) {
    console.error(
      `rankings sweep failed for keyword="${keyword}": ${err instanceof Error ? err.message : String(err)}`
    );
    // Best-effort: record a null-rank row so we have a history entry.
    // If even this write fails, we count the keyword as fully failed.
    try {
      await upsertKeywordRanking(env.DB, windowStart, {
        keyword,
        rank: null,
        urlRanked: null,
        serpFeatures: [],
        totalResults: null,
      });
    } catch {
      // fall through; reported as failed below
    }
    return { keyword, rank: null, urlRanked: null, failed: true };
  }
}

interface SerperOrganicResult {
  position?: number;
  title?: string;
  link?: string;
  snippet?: string;
}

interface SerperResponse {
  organic?: SerperOrganicResult[];
  searchInformation?: { totalResults?: string };
  knowledgeGraph?: unknown;
  answerBox?: unknown;
  peopleAlsoAsk?: unknown[];
  relatedSearches?: unknown[];
  topStories?: unknown[];
  videos?: unknown[];
}

export interface ParsedSerp {
  organic: SerperOrganicResult[];
  features: string[];
  totalResults: number | null;
}

/**
 * Hit Serper for one keyword and parse out organic results + SERP
 * features. Exported for testing — the features list and totalResults
 * parser are easy to mis-implement against Serper's loosely-typed
 * response shapes.
 */
export async function fetchSerperResults(
  apiKey: string,
  keyword: string
): Promise<ParsedSerp> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    RANKINGS_BUDGET.perKeywordTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(SERPER_API_URL, {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: keyword, num: 10, gl: 'us', hl: 'en' }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Serper API ${response.status}: ${body.slice(0, 500)}`);
  }

  const data = (await response.json()) as SerperResponse;
  const organic = Array.isArray(data.organic) ? data.organic : [];

  const features: string[] = [];
  if (data.knowledgeGraph) features.push('knowledge_graph');
  if (data.answerBox) features.push('answer_box');
  if (Array.isArray(data.peopleAlsoAsk) && data.peopleAlsoAsk.length > 0) {
    features.push('people_also_ask');
  }
  if (Array.isArray(data.topStories) && data.topStories.length > 0) {
    features.push('top_stories');
  }
  if (Array.isArray(data.videos) && data.videos.length > 0) {
    features.push('videos');
  }
  if (Array.isArray(data.relatedSearches) && data.relatedSearches.length > 0) {
    features.push('related_searches');
  }

  return {
    organic,
    features,
    totalResults: parseTotalResults(data.searchInformation?.totalResults),
  };
}

/**
 * Serper returns totalResults as a human-readable string like
 * "About 1,230,000 results" or as a plain digit string. Strip non-digits
 * and parse; return null if nothing useful is left.
 *
 * Exported for direct unit testing.
 */
export function parseTotalResults(raw: string | undefined): number | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? n : null;
}

/**
 * Find our site's rank in the organic results. Matches on hostname with
 * exact + subdomain support: `agenticaiccounting.com` matches both
 * `agenticaiccounting.com` and `www.agenticaiccounting.com`, but NOT
 * `notagenticaiccounting.com`.
 *
 * Exported for direct unit testing.
 */
export function findOurRank(
  serp: ParsedSerp,
  hostname: string
): { rank: number | null; url: string | null } {
  const lowerHost = hostname.toLowerCase();
  for (const result of serp.organic) {
    if (!result || !result.link) continue;
    let parsedHost: string;
    try {
      parsedHost = new URL(result.link).hostname.toLowerCase();
    } catch {
      continue;
    }
    if (parsedHost === lowerHost || parsedHost.endsWith('.' + lowerHost)) {
      return {
        rank: typeof result.position === 'number' ? result.position : null,
        url: result.link,
      };
    }
  }
  return { rank: null, url: null };
}
