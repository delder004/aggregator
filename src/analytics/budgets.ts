/**
 * Hard budgets and timeouts for the Phase 1 capture layer.
 * One central file so every job pulls the same numbers and we can audit
 * worst-case subrequest counts in one place.
 *
 * Worst-case weekly ingest subrequests:
 *   CF GraphQL                              1
 *   Analytics Engine SQL rollup             1
 *   Search Console (OAuth + totals +
 *     topQueries + topPages)                4
 *   Rankings (30 keywords)                 30
 *   Competitors (10 × 2 fetches)           20
 *   -------------------------------------------
 *   Total                                  56  (well under the 1000 ceiling)
 */

export const STALE_RUN_THRESHOLD_MS = 10 * 60 * 1000;

export const COMPETITOR_BUDGET = {
  maxCompetitors: 10,
  fetchTimeoutMs: 8_000,
  maxItemsPerCompetitor: 50,
} as const;

export const RANKINGS_BUDGET = {
  maxKeywordsPerSweep: 30,
  perKeywordTimeoutMs: 5_000,
} as const;

export const CF_ANALYTICS_BUDGET = {
  graphqlTimeoutMs: 15_000,
  topPathsLimit: 25,
  topReferrersLimit: 25,
  topCountriesLimit: 25,
} as const;

export const SEARCH_CONSOLE_BUDGET = {
  apiTimeoutMs: 15_000,
  rowLimit: 250,
} as const;

export const ANALYTICS_ENGINE_BUDGET = {
  rollupTimeoutMs: 15_000,
  // Headroom for 7 complete UTC days × ~1.4k articles/day. The rollup throws
  // if rows_before_limit_at_least exceeds this, so growth fails loudly
  // rather than silently truncating.
  rollupRowLimit: 10_000,
} as const;

export const BLOB_NAMESPACES = {
  cfAnalytics: 'cf-analytics',
  searchConsole: 'search-console',
  rankings: 'rankings',
  competitors: 'competitors',
} as const;
