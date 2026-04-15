import type {
  ArticleViewRow,
  CfAnalyticsSnapshot,
  CompetitorSnapshot,
  IngestNamespaceStatus,
  KeywordRanking,
  SearchConsoleSnapshot,
  SnapshotStatus,
  SourceCandidate,
  SourceCandidateOrigin,
  SourceCandidateStatus,
} from './types';
import { STALE_RUN_THRESHOLD_MS } from './budgets';

/**
 * Idempotent UPSERT helpers for the Phase 1 capture layer.
 *
 * Every snapshot writer follows this contract:
 *   1. Compute window via getWeeklyWindow().
 *   2. Call claim*() to insert-or-reclaim the row. If it returns null, the
 *      window is already complete or another worker holds an active claim,
 *      and the writer must no-op.
 *   3. Do the work.
 *   4. Call complete*() with metadata + KV blob key on success, or fail*()
 *      with the error message on failure.
 *
 * Stale-run gate: a row in 'running' state is reclaimable only if its
 * updated_at is older than STALE_RUN_THRESHOLD_MS. This prevents two
 * concurrent jobs from clobbering each other while still allowing
 * recovery from a job that died mid-flight.
 */

function nowIso(): string {
  return new Date().toISOString();
}

function staleCutoffIso(): string {
  return new Date(Date.now() - STALE_RUN_THRESHOLD_MS).toISOString();
}

function generateId(): string {
  return crypto.randomUUID();
}

// -- cf_analytics_snapshots --

export async function claimCfAnalyticsSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  source: 'graphql' | 'analytics_engine'
): Promise<{ id: string } | null> {
  const id = generateId();
  const now = nowIso();
  const cutoff = staleCutoffIso();
  const result = await db
    .prepare(
      `INSERT INTO cf_analytics_snapshots (
         id, window_start, window_end, source, status,
         attempt_count, started_at, updated_at, error_message
       ) VALUES (?, ?, ?, ?, 'running', 1, ?, ?, NULL)
       ON CONFLICT (window_start, window_end, source) DO UPDATE SET
         status = 'running',
         attempt_count = cf_analytics_snapshots.attempt_count + 1,
         started_at = excluded.started_at,
         updated_at = excluded.updated_at,
         error_message = NULL
       WHERE cf_analytics_snapshots.status <> 'complete'
         AND (
           cf_analytics_snapshots.status <> 'running'
           OR cf_analytics_snapshots.updated_at < ?
         )
       RETURNING id`
    )
    .bind(id, windowStart, windowEnd, source, now, now, cutoff)
    .first<{ id: string }>();
  return result ?? null;
}

export async function completeCfAnalyticsSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  source: 'graphql' | 'analytics_engine',
  data: {
    blobKey: string;
    totalRequests: number | null;
    totalPageViews: number | null;
    uniqueVisitors: number | null;
    cachedPercentage: number | null;
    topPathsCount: number | null;
    topReferrersCount: number | null;
    topCountriesCount: number | null;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE cf_analytics_snapshots
       SET status = 'complete',
           completed_at = ?,
           updated_at = ?,
           error_message = NULL,
           blob_key = ?,
           total_requests = ?,
           total_page_views = ?,
           unique_visitors = ?,
           cached_percentage = ?,
           top_paths_count = ?,
           top_referrers_count = ?,
           top_countries_count = ?
       WHERE window_start = ? AND window_end = ? AND source = ?`
    )
    .bind(
      now,
      now,
      data.blobKey,
      data.totalRequests,
      data.totalPageViews,
      data.uniqueVisitors,
      data.cachedPercentage,
      data.topPathsCount,
      data.topReferrersCount,
      data.topCountriesCount,
      windowStart,
      windowEnd,
      source
    )
    .run();
}

export async function failCfAnalyticsSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  source: 'graphql' | 'analytics_engine',
  errorMessage: string
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE cf_analytics_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE window_start = ? AND window_end = ? AND source = ?`
    )
    .bind(now, errorMessage, windowStart, windowEnd, source)
    .run();
}

export async function listCfAnalyticsSnapshots(
  db: D1Database,
  limit = 20
): Promise<CfAnalyticsSnapshot[]> {
  const result = await db
    .prepare(
      `SELECT * FROM cf_analytics_snapshots
       ORDER BY window_start DESC, source
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results.map(mapCfAnalyticsRow);
}

export async function getCfAnalyticsSnapshotById(
  db: D1Database,
  id: string
): Promise<CfAnalyticsSnapshot | null> {
  const row = await db
    .prepare(`SELECT * FROM cf_analytics_snapshots WHERE id = ?`)
    .bind(id)
    .first();
  return row ? mapCfAnalyticsRow(row) : null;
}

function mapCfAnalyticsRow(row: Record<string, unknown>): CfAnalyticsSnapshot {
  return {
    id: row.id as string,
    windowStart: row.window_start as string,
    windowEnd: row.window_end as string,
    source: row.source as 'graphql' | 'analytics_engine',
    status: row.status as SnapshotStatus,
    attemptCount: Number(row.attempt_count ?? 0),
    startedAt: row.started_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    blobKey: (row.blob_key as string | null) ?? null,
    totalRequests: nullableNumber(row.total_requests),
    totalPageViews: nullableNumber(row.total_page_views),
    uniqueVisitors: nullableNumber(row.unique_visitors),
    cachedPercentage: nullableNumber(row.cached_percentage),
    topPathsCount: nullableNumber(row.top_paths_count),
    topReferrersCount: nullableNumber(row.top_referrers_count),
    topCountriesCount: nullableNumber(row.top_countries_count),
  };
}

// -- search_console_snapshots --

export async function claimSearchConsoleSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string
): Promise<{ id: string } | null> {
  const id = generateId();
  const now = nowIso();
  const cutoff = staleCutoffIso();
  const result = await db
    .prepare(
      `INSERT INTO search_console_snapshots (
         id, window_start, window_end, status,
         attempt_count, started_at, updated_at, error_message
       ) VALUES (?, ?, ?, 'running', 1, ?, ?, NULL)
       ON CONFLICT (window_start, window_end) DO UPDATE SET
         status = 'running',
         attempt_count = search_console_snapshots.attempt_count + 1,
         started_at = excluded.started_at,
         updated_at = excluded.updated_at,
         error_message = NULL
       WHERE search_console_snapshots.status <> 'complete'
         AND (
           search_console_snapshots.status <> 'running'
           OR search_console_snapshots.updated_at < ?
         )
       RETURNING id`
    )
    .bind(id, windowStart, windowEnd, now, now, cutoff)
    .first<{ id: string }>();
  return result ?? null;
}

export async function completeSearchConsoleSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  data: {
    blobKey: string;
    totalImpressions: number | null;
    totalClicks: number | null;
    avgCtr: number | null;
    avgPosition: number | null;
    queriesCount: number | null;
    pagesCount: number | null;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE search_console_snapshots
       SET status = 'complete',
           completed_at = ?, updated_at = ?, error_message = NULL,
           blob_key = ?, total_impressions = ?, total_clicks = ?,
           avg_ctr = ?, avg_position = ?, queries_count = ?, pages_count = ?
       WHERE window_start = ? AND window_end = ?`
    )
    .bind(
      now,
      now,
      data.blobKey,
      data.totalImpressions,
      data.totalClicks,
      data.avgCtr,
      data.avgPosition,
      data.queriesCount,
      data.pagesCount,
      windowStart,
      windowEnd
    )
    .run();
}

export async function failSearchConsoleSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  errorMessage: string
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE search_console_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE window_start = ? AND window_end = ?`
    )
    .bind(now, errorMessage, windowStart, windowEnd)
    .run();
}

export async function listSearchConsoleSnapshots(
  db: D1Database,
  limit = 20
): Promise<SearchConsoleSnapshot[]> {
  const result = await db
    .prepare(
      `SELECT * FROM search_console_snapshots
       ORDER BY window_start DESC LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results.map(mapSearchConsoleRow);
}

export async function getSearchConsoleSnapshotById(
  db: D1Database,
  id: string
): Promise<SearchConsoleSnapshot | null> {
  const row = await db
    .prepare(`SELECT * FROM search_console_snapshots WHERE id = ?`)
    .bind(id)
    .first();
  return row ? mapSearchConsoleRow(row) : null;
}

function mapSearchConsoleRow(row: Record<string, unknown>): SearchConsoleSnapshot {
  return {
    id: row.id as string,
    windowStart: row.window_start as string,
    windowEnd: row.window_end as string,
    status: row.status as SnapshotStatus,
    attemptCount: Number(row.attempt_count ?? 0),
    startedAt: row.started_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    blobKey: (row.blob_key as string | null) ?? null,
    totalImpressions: nullableNumber(row.total_impressions),
    totalClicks: nullableNumber(row.total_clicks),
    avgCtr: nullableNumber(row.avg_ctr),
    avgPosition: nullableNumber(row.avg_position),
    queriesCount: nullableNumber(row.queries_count),
    pagesCount: nullableNumber(row.pages_count),
  };
}

// -- competitor_snapshots --

export async function claimCompetitorSnapshot(
  db: D1Database,
  competitorSlug: string,
  windowStart: string,
  windowEnd: string
): Promise<{ id: string } | null> {
  const id = generateId();
  const now = nowIso();
  const cutoff = staleCutoffIso();
  const result = await db
    .prepare(
      `INSERT INTO competitor_snapshots (
         id, competitor_slug, window_start, window_end, status,
         attempt_count, started_at, updated_at, error_message
       ) VALUES (?, ?, ?, ?, 'running', 1, ?, ?, NULL)
       ON CONFLICT (competitor_slug, window_start) DO UPDATE SET
         status = 'running',
         attempt_count = competitor_snapshots.attempt_count + 1,
         started_at = excluded.started_at,
         updated_at = excluded.updated_at,
         error_message = NULL
       WHERE competitor_snapshots.status <> 'complete'
         AND (
           competitor_snapshots.status <> 'running'
           OR competitor_snapshots.updated_at < ?
         )
       RETURNING id`
    )
    .bind(id, competitorSlug, windowStart, windowEnd, now, now, cutoff)
    .first<{ id: string }>();
  return result ?? null;
}

export async function completeCompetitorSnapshot(
  db: D1Database,
  competitorSlug: string,
  windowStart: string,
  data: {
    blobKey: string;
    itemsCount: number;
    homepageHtmlHash: string | null;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE competitor_snapshots
       SET status = 'complete', completed_at = ?, updated_at = ?,
           error_message = NULL, blob_key = ?, items_count = ?,
           homepage_html_hash = ?
       WHERE competitor_slug = ? AND window_start = ?`
    )
    .bind(
      now,
      now,
      data.blobKey,
      data.itemsCount,
      data.homepageHtmlHash,
      competitorSlug,
      windowStart
    )
    .run();
}

export async function failCompetitorSnapshot(
  db: D1Database,
  competitorSlug: string,
  windowStart: string,
  errorMessage: string
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `UPDATE competitor_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE competitor_slug = ? AND window_start = ?`
    )
    .bind(now, errorMessage, competitorSlug, windowStart)
    .run();
}

export async function listCompetitorSnapshots(
  db: D1Database,
  limit = 50
): Promise<CompetitorSnapshot[]> {
  const result = await db
    .prepare(
      `SELECT * FROM competitor_snapshots
       ORDER BY window_start DESC, competitor_slug LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results.map(mapCompetitorRow);
}

export async function getCompetitorSnapshotById(
  db: D1Database,
  id: string
): Promise<CompetitorSnapshot | null> {
  const row = await db
    .prepare(`SELECT * FROM competitor_snapshots WHERE id = ?`)
    .bind(id)
    .first();
  return row ? mapCompetitorRow(row) : null;
}

function mapCompetitorRow(row: Record<string, unknown>): CompetitorSnapshot {
  return {
    id: row.id as string,
    competitorSlug: row.competitor_slug as string,
    windowStart: row.window_start as string,
    windowEnd: row.window_end as string,
    status: row.status as SnapshotStatus,
    attemptCount: Number(row.attempt_count ?? 0),
    startedAt: row.started_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    blobKey: (row.blob_key as string | null) ?? null,
    itemsCount: nullableNumber(row.items_count),
    homepageHtmlHash: (row.homepage_html_hash as string | null) ?? null,
  };
}

// -- keyword_rankings --

export async function upsertKeywordRanking(
  db: D1Database,
  windowStart: string,
  ranking: {
    keyword: string;
    rank: number | null;
    urlRanked: string | null;
    serpFeatures: string[];
    totalResults: number | null;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO keyword_rankings (
         id, keyword, checked_at, window_start, rank, url_ranked, serp_features_json, total_results
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (keyword, window_start) DO UPDATE SET
         checked_at = excluded.checked_at,
         rank = excluded.rank,
         url_ranked = excluded.url_ranked,
         serp_features_json = excluded.serp_features_json,
         total_results = excluded.total_results`
    )
    .bind(
      generateId(),
      ranking.keyword,
      now,
      windowStart,
      ranking.rank,
      ranking.urlRanked,
      JSON.stringify(ranking.serpFeatures),
      ranking.totalResults
    )
    .run();
}

export async function listRecentKeywordRankings(
  db: D1Database,
  limit = 100
): Promise<KeywordRanking[]> {
  const result = await db
    .prepare(
      `SELECT * FROM keyword_rankings
       ORDER BY checked_at DESC, keyword LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results.map(mapKeywordRankingRow);
}

function mapKeywordRankingRow(row: Record<string, unknown>): KeywordRanking {
  let serpFeatures: string[] = [];
  try {
    const parsed = JSON.parse((row.serp_features_json as string) || '[]');
    if (Array.isArray(parsed)) {
      serpFeatures = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch {
    // leave empty
  }
  return {
    id: row.id as string,
    keyword: row.keyword as string,
    checkedAt: row.checked_at as string,
    windowStart: row.window_start as string,
    rank: nullableNumber(row.rank),
    urlRanked: (row.url_ranked as string | null) ?? null,
    serpFeatures,
    totalResults: nullableNumber(row.total_results),
  };
}

// -- article_views --

export async function upsertArticleViewRow(
  db: D1Database,
  row: ArticleViewRow
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO article_views (
         article_id, view_date, views, unique_visitors, top_referrer, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT (article_id, view_date) DO UPDATE SET
         views = excluded.views,
         unique_visitors = excluded.unique_visitors,
         top_referrer = excluded.top_referrer,
         updated_at = excluded.updated_at`
    )
    .bind(
      row.articleId,
      row.viewDate,
      row.views,
      row.uniqueVisitors,
      row.topReferrer,
      row.updatedAt
    )
    .run();
}

export async function listTopArticleViews(
  db: D1Database,
  sinceDate: string,
  limit = 50
): Promise<ArticleViewRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM article_views
       WHERE view_date >= ?
       ORDER BY views DESC LIMIT ?`
    )
    .bind(sinceDate, limit)
    .all();
  return result.results.map((row) => ({
    articleId: row.article_id as string,
    viewDate: row.view_date as string,
    views: Number(row.views ?? 0),
    uniqueVisitors: Number(row.unique_visitors ?? 0),
    topReferrer: (row.top_referrer as string | null) ?? null,
    updatedAt: row.updated_at as string,
  }));
}

// -- source_candidates --

export async function upsertSourceCandidate(
  db: D1Database,
  candidate: {
    name: string;
    url: string;
    sourceTypeGuess: string | null;
    rationale: string | null;
    origin: SourceCandidateOrigin;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO source_candidates (
         id, name, url, source_type_guess, rationale, origin, status,
         first_seen_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?)
       ON CONFLICT (url) DO UPDATE SET
         updated_at = excluded.updated_at,
         rationale = COALESCE(excluded.rationale, source_candidates.rationale),
         source_type_guess = COALESCE(excluded.source_type_guess, source_candidates.source_type_guess)`
    )
    .bind(
      generateId(),
      candidate.name,
      candidate.url,
      candidate.sourceTypeGuess,
      candidate.rationale,
      candidate.origin,
      now,
      now
    )
    .run();
}

export async function listSourceCandidates(
  db: D1Database,
  status?: SourceCandidateStatus,
  limit = 100
): Promise<SourceCandidate[]> {
  const stmt = status
    ? db
        .prepare(
          `SELECT * FROM source_candidates WHERE status = ?
           ORDER BY first_seen_at DESC LIMIT ?`
        )
        .bind(status, limit)
    : db
        .prepare(
          `SELECT * FROM source_candidates
           ORDER BY first_seen_at DESC LIMIT ?`
        )
        .bind(limit);
  const result = await stmt.all();
  return result.results.map((row) => ({
    id: row.id as string,
    name: row.name as string,
    url: row.url as string,
    sourceTypeGuess: (row.source_type_guess as string | null) ?? null,
    rationale: (row.rationale as string | null) ?? null,
    origin: row.origin as SourceCandidateOrigin,
    status: row.status as SourceCandidateStatus,
    firstSeenAt: row.first_seen_at as string,
    updatedAt: row.updated_at as string,
    promotedToSourceId: (row.promoted_to_source_id as string | null) ?? null,
  }));
}

// -- /ops/ingest/status --

export async function getIngestStatus(
  db: D1Database
): Promise<IngestNamespaceStatus[]> {
  // One most-recent row per namespace. Five namespaces are always present;
  // any with no data yet appear as { status: 'never', windowStart: null }.
  const queries: Array<{
    namespace: IngestNamespaceStatus['namespace'];
    sql: string;
  }> = [
    {
      namespace: 'cf-analytics',
      sql: `SELECT window_start, window_end, status, attempt_count,
                   started_at, updated_at, completed_at, error_message
            FROM cf_analytics_snapshots
            ORDER BY window_start DESC LIMIT 1`,
    },
    {
      namespace: 'search-console',
      sql: `SELECT window_start, window_end, status, attempt_count,
                   started_at, updated_at, completed_at, error_message
            FROM search_console_snapshots
            ORDER BY window_start DESC LIMIT 1`,
    },
    {
      namespace: 'rankings',
      sql: `SELECT window_start AS window_start,
                   window_start AS window_end,
                   'complete' AS status,
                   1 AS attempt_count,
                   checked_at AS started_at,
                   checked_at AS updated_at,
                   checked_at AS completed_at,
                   NULL AS error_message
            FROM keyword_rankings
            ORDER BY checked_at DESC LIMIT 1`,
    },
    {
      namespace: 'competitors',
      sql: `SELECT window_start, window_end, status, attempt_count,
                   started_at, updated_at, completed_at, error_message
            FROM competitor_snapshots
            ORDER BY window_start DESC LIMIT 1`,
    },
    {
      namespace: 'article-views-rollup',
      sql: `SELECT view_date AS window_start,
                   view_date AS window_end,
                   'complete' AS status,
                   1 AS attempt_count,
                   updated_at AS started_at,
                   updated_at AS updated_at,
                   updated_at AS completed_at,
                   NULL AS error_message
            FROM article_views
            ORDER BY view_date DESC LIMIT 1`,
    },
  ];

  const results: IngestNamespaceStatus[] = [];
  for (const { namespace, sql } of queries) {
    const row = await db.prepare(sql).first();
    if (!row) {
      results.push({
        namespace,
        windowStart: null,
        windowEnd: null,
        status: 'never',
        attemptCount: 0,
        startedAt: null,
        updatedAt: null,
        completedAt: null,
        errorMessage: null,
      });
      continue;
    }
    results.push({
      namespace,
      windowStart: (row.window_start as string | null) ?? null,
      windowEnd: (row.window_end as string | null) ?? null,
      status: (row.status as SnapshotStatus) ?? 'never',
      attemptCount: Number(row.attempt_count ?? 0),
      startedAt: (row.started_at as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
    });
  }
  return results;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
