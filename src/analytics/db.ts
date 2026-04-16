import type {
  ArticleViewRow,
  CfAnalyticsSnapshot,
  CompetitorSnapshot,
  ConsolidationProposal,
  ConsolidationStatus,
  IngestNamespace,
  IngestNamespaceStatus,
  IngestRun,
  IngestRunStatus,
  KeywordRanking,
  RunConsolidation,
  SearchConsoleSnapshot,
  SnapshotStatus,
  SourceCandidate,
  SourceCandidateOrigin,
  SourceCandidateStatus,
  TopArticleByViews,
} from './types';
import { STALE_RUN_THRESHOLD_MS } from './budgets';

/**
 * Idempotent UPSERT helpers for the Phase 1 capture layer.
 *
 * Every snapshot writer follows this contract:
 *   1. Compute window via getWeeklyWindow().
 *   2. Call claim*() to insert-or-reclaim the row. It returns
 *      { id, attemptCount } on success or null when the window is already
 *      complete or another worker holds a fresh active claim.
 *   3. Do the work.
 *   4. Call complete*() / fail*() with the attemptCount returned by claim*().
 *      Both return a boolean: true means the write was applied; false means
 *      the row was reclaimed by another worker mid-flight and the caller
 *      must drop its result without retrying.
 *
 * Stale-run gate: a row in 'running' state is reclaimable only if its
 * updated_at is older than STALE_RUN_THRESHOLD_MS. Reclaiming bumps
 * attempt_count, which acts as a generation counter — any late-finishing
 * write from the previous owner is rejected by the WHERE clause check on
 * attempt_count, so workers can never clobber each other's results.
 */

export interface SnapshotClaim {
  id: string;
  attemptCount: number;
}

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
): Promise<SnapshotClaim | null> {
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
       RETURNING id, attempt_count`
    )
    .bind(id, windowStart, windowEnd, source, now, now, cutoff)
    .first<{ id: string; attempt_count: number }>();
  if (!result) {
    return null;
  }
  return { id: result.id, attemptCount: Number(result.attempt_count) };
}

export async function completeCfAnalyticsSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  source: 'graphql' | 'analytics_engine',
  expectedAttemptCount: number,
  data: {
    blobKey: string;
    totalRequests: number | null;
    totalPageViews: number | null;
    totalVisits: number | null;
    uniqueVisitors: number | null;
    cachedPercentage: number | null;
    topPathsCount: number | null;
    topReferrersCount: number | null;
    topCountriesCount: number | null;
  }
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE cf_analytics_snapshots
       SET status = 'complete',
           completed_at = ?,
           updated_at = ?,
           error_message = NULL,
           blob_key = ?,
           total_requests = ?,
           total_page_views = ?,
           total_visits = ?,
           unique_visitors = ?,
           cached_percentage = ?,
           top_paths_count = ?,
           top_referrers_count = ?,
           top_countries_count = ?
       WHERE window_start = ? AND window_end = ? AND source = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(
      now,
      now,
      data.blobKey,
      data.totalRequests,
      data.totalPageViews,
      data.totalVisits,
      data.uniqueVisitors,
      data.cachedPercentage,
      data.topPathsCount,
      data.topReferrersCount,
      data.topCountriesCount,
      windowStart,
      windowEnd,
      source,
      expectedAttemptCount
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function failCfAnalyticsSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  source: 'graphql' | 'analytics_engine',
  expectedAttemptCount: number,
  errorMessage: string
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE cf_analytics_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE window_start = ? AND window_end = ? AND source = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(now, errorMessage, windowStart, windowEnd, source, expectedAttemptCount)
    .run();
  return (result.meta?.changes ?? 0) > 0;
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

export async function getCfAnalyticsSnapshotByWindow(
  db: D1Database,
  windowStart: string,
  source: 'graphql' | 'analytics_engine' = 'graphql'
): Promise<CfAnalyticsSnapshot | null> {
  const row = await db
    .prepare(
      `SELECT * FROM cf_analytics_snapshots
       WHERE window_start = ? AND source = ? AND status = 'complete'
       LIMIT 1`
    )
    .bind(windowStart, source)
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
    totalVisits: nullableNumber(row.total_visits),
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
): Promise<SnapshotClaim | null> {
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
       RETURNING id, attempt_count`
    )
    .bind(id, windowStart, windowEnd, now, now, cutoff)
    .first<{ id: string; attempt_count: number }>();
  if (!result) {
    return null;
  }
  return { id: result.id, attemptCount: Number(result.attempt_count) };
}

export async function completeSearchConsoleSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  expectedAttemptCount: number,
  data: {
    blobKey: string;
    totalImpressions: number | null;
    totalClicks: number | null;
    avgCtr: number | null;
    avgPosition: number | null;
    queriesCount: number | null;
    pagesCount: number | null;
  }
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE search_console_snapshots
       SET status = 'complete',
           completed_at = ?, updated_at = ?, error_message = NULL,
           blob_key = ?, total_impressions = ?, total_clicks = ?,
           avg_ctr = ?, avg_position = ?, queries_count = ?, pages_count = ?
       WHERE window_start = ? AND window_end = ?
         AND attempt_count = ? AND status = 'running'`
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
      windowEnd,
      expectedAttemptCount
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function failSearchConsoleSnapshot(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  expectedAttemptCount: number,
  errorMessage: string
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE search_console_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE window_start = ? AND window_end = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(now, errorMessage, windowStart, windowEnd, expectedAttemptCount)
    .run();
  return (result.meta?.changes ?? 0) > 0;
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

export async function getSearchConsoleSnapshotByWindow(
  db: D1Database,
  windowStart: string
): Promise<SearchConsoleSnapshot | null> {
  const row = await db
    .prepare(
      `SELECT * FROM search_console_snapshots
       WHERE window_start = ? AND status = 'complete'
       LIMIT 1`
    )
    .bind(windowStart)
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
): Promise<SnapshotClaim | null> {
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
       RETURNING id, attempt_count`
    )
    .bind(id, competitorSlug, windowStart, windowEnd, now, now, cutoff)
    .first<{ id: string; attempt_count: number }>();
  if (!result) {
    return null;
  }
  return { id: result.id, attemptCount: Number(result.attempt_count) };
}

export async function completeCompetitorSnapshot(
  db: D1Database,
  competitorSlug: string,
  windowStart: string,
  expectedAttemptCount: number,
  data: {
    blobKey: string;
    itemsCount: number;
    homepageHtmlHash: string | null;
  }
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE competitor_snapshots
       SET status = 'complete', completed_at = ?, updated_at = ?,
           error_message = NULL, blob_key = ?, items_count = ?,
           homepage_html_hash = ?
       WHERE competitor_slug = ? AND window_start = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(
      now,
      now,
      data.blobKey,
      data.itemsCount,
      data.homepageHtmlHash,
      competitorSlug,
      windowStart,
      expectedAttemptCount
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function failCompetitorSnapshot(
  db: D1Database,
  competitorSlug: string,
  windowStart: string,
  expectedAttemptCount: number,
  errorMessage: string
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE competitor_snapshots
       SET status = 'error', updated_at = ?, error_message = ?
       WHERE competitor_slug = ? AND window_start = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(now, errorMessage, competitorSlug, windowStart, expectedAttemptCount)
    .run();
  return (result.meta?.changes ?? 0) > 0;
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

export async function listCompetitorSnapshotsByWindow(
  db: D1Database,
  windowStart: string
): Promise<CompetitorSnapshot[]> {
  const result = await db
    .prepare(
      `SELECT * FROM competitor_snapshots
       WHERE window_start = ? AND status = 'complete'
       ORDER BY competitor_slug`
    )
    .bind(windowStart)
    .all();
  return result.results.map(mapCompetitorRow);
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

export async function listKeywordRankingsByWindow(
  db: D1Database,
  windowStart: string
): Promise<KeywordRanking[]> {
  const result = await db
    .prepare(
      `SELECT * FROM keyword_rankings
       WHERE window_start = ?
       ORDER BY keyword`
    )
    .bind(windowStart)
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

// listTopArticleViews intentionally omitted in Phase 1. Phase 2 will need a
// per-article aggregation (GROUP BY article_id, SUM(views)) keyed to the
// consolidation window — adding it here without a caller would ship the
// wrong shape (raw daily rows can repeat the same article).

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

// -- ingest_runs --

const ALL_INGEST_NAMESPACES: readonly IngestNamespace[] = [
  'cf-analytics',
  'search-console',
  'rankings',
  'competitors',
  'article-views-rollup',
];

export async function upsertIngestRun(
  db: D1Database,
  run: {
    id: string;
    pipelineRunId: string;
    namespace: IngestNamespace;
    windowStart: string;
    windowEnd: string;
    status: IngestRunStatus;
    startedAt: string | null;
    completedAt: string | null;
    errorMessage: string | null;
    metrics: Record<string, string | number | boolean | null>;
  }
): Promise<void> {
  const now = nowIso();
  await db
    .prepare(
      `INSERT INTO ingest_runs (
         id, pipeline_run_id, namespace, window_start, window_end,
         status, started_at, completed_at, updated_at, error_message, metrics_json
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (namespace, window_start) DO UPDATE SET
         pipeline_run_id = excluded.pipeline_run_id,
         status = excluded.status,
         started_at = COALESCE(excluded.started_at, ingest_runs.started_at),
         completed_at = excluded.completed_at,
         updated_at = excluded.updated_at,
         error_message = excluded.error_message,
         metrics_json = excluded.metrics_json`
    )
    .bind(
      run.id,
      run.pipelineRunId,
      run.namespace,
      run.windowStart,
      run.windowEnd,
      run.status,
      run.startedAt,
      run.completedAt,
      now,
      run.errorMessage,
      JSON.stringify(run.metrics)
    )
    .run();
}

export async function getIngestStatus(
  db: D1Database
): Promise<IngestNamespaceStatus[]> {
  const results: IngestNamespaceStatus[] = [];
  for (const namespace of ALL_INGEST_NAMESPACES) {
    const row = await db
      .prepare(
        `SELECT namespace, window_start, window_end, status,
                started_at, completed_at, updated_at, error_message, metrics_json
         FROM ingest_runs
         WHERE namespace = ?
         ORDER BY window_start DESC LIMIT 1`
      )
      .bind(namespace)
      .first();
    if (!row) {
      results.push({
        namespace,
        windowStart: null,
        windowEnd: null,
        status: 'never',
        startedAt: null,
        completedAt: null,
        updatedAt: null,
        errorMessage: null,
        metrics: {},
      });
      continue;
    }
    let metrics: Record<string, string | number | boolean | null> = {};
    try {
      const parsed = JSON.parse((row.metrics_json as string) || '{}');
      if (typeof parsed === 'object' && parsed !== null) {
        metrics = parsed as Record<string, string | number | boolean | null>;
      }
    } catch {
      // leave empty
    }
    results.push({
      namespace,
      windowStart: (row.window_start as string | null) ?? null,
      windowEnd: (row.window_end as string | null) ?? null,
      status: (row.status as IngestRunStatus) ?? 'pending',
      startedAt: (row.started_at as string | null) ?? null,
      completedAt: (row.completed_at as string | null) ?? null,
      updatedAt: (row.updated_at as string | null) ?? null,
      errorMessage: (row.error_message as string | null) ?? null,
      metrics,
    });
  }
  return results;
}

// -- run_consolidations --

export async function claimConsolidation(
  db: D1Database,
  windowStart: string,
  windowEnd: string
): Promise<SnapshotClaim | null> {
  const id = generateId();
  const now = nowIso();
  const cutoff = staleCutoffIso();
  const result = await db
    .prepare(
      `INSERT INTO run_consolidations (
         id, window_start, window_end, status,
         attempt_count, started_at, updated_at, error_message
       ) VALUES (?, ?, ?, 'running', 1, ?, ?, NULL)
       ON CONFLICT (window_start, window_end) DO UPDATE SET
         status = 'running',
         attempt_count = run_consolidations.attempt_count + 1,
         started_at = excluded.started_at,
         updated_at = excluded.updated_at,
         error_message = NULL
       WHERE run_consolidations.status <> 'complete'
         AND (
           run_consolidations.status <> 'running'
           OR run_consolidations.updated_at < ?
         )
       RETURNING id, attempt_count`
    )
    .bind(id, windowStart, windowEnd, now, now, cutoff)
    .first<{ id: string; attempt_count: number }>();
  if (!result) {
    return null;
  }
  return { id: result.id, attemptCount: Number(result.attempt_count) };
}

export async function completeConsolidation(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  expectedAttemptCount: number,
  data: {
    inputRunIds: string[];
    inputSnapshotIds: Record<string, string[]>;
    contextBlobKey: string;
    contextTokenEstimate: number;
    aiModel: string;
    aiOutputBlobKey: string;
    aiSummary: string;
    aiProposals: ConsolidationProposal[];
    aiTokenUsage: Record<string, number>;
  }
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE run_consolidations
       SET status = 'complete',
           completed_at = ?, updated_at = ?, error_message = NULL,
           input_run_ids_json = ?, input_snapshot_ids_json = ?,
           context_blob_key = ?, context_token_estimate = ?,
           ai_model = ?, ai_output_blob_key = ?,
           ai_summary = ?, ai_proposals_json = ?,
           ai_token_usage_json = ?
       WHERE window_start = ? AND window_end = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(
      now,
      now,
      JSON.stringify(data.inputRunIds),
      JSON.stringify(data.inputSnapshotIds),
      data.contextBlobKey,
      data.contextTokenEstimate,
      data.aiModel,
      data.aiOutputBlobKey,
      data.aiSummary,
      JSON.stringify(data.aiProposals),
      JSON.stringify(data.aiTokenUsage),
      windowStart,
      windowEnd,
      expectedAttemptCount
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function failConsolidation(
  db: D1Database,
  windowStart: string,
  windowEnd: string,
  expectedAttemptCount: number,
  errorMessage: string,
  blobKeys?: {
    contextBlobKey?: string;
    aiOutputBlobKey?: string;
  }
): Promise<boolean> {
  const now = nowIso();
  const result = await db
    .prepare(
      `UPDATE run_consolidations
       SET status = 'error', updated_at = ?, error_message = ?,
           context_blob_key = COALESCE(?, context_blob_key),
           ai_output_blob_key = COALESCE(?, ai_output_blob_key)
       WHERE window_start = ? AND window_end = ?
         AND attempt_count = ? AND status = 'running'`
    )
    .bind(
      now,
      errorMessage,
      blobKeys?.contextBlobKey ?? null,
      blobKeys?.aiOutputBlobKey ?? null,
      windowStart,
      windowEnd,
      expectedAttemptCount
    )
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function listConsolidations(
  db: D1Database,
  limit = 20
): Promise<RunConsolidation[]> {
  const result = await db
    .prepare(
      `SELECT * FROM run_consolidations
       ORDER BY window_start DESC LIMIT ?`
    )
    .bind(limit)
    .all();
  return result.results.map(mapConsolidationRow);
}

export async function getConsolidationById(
  db: D1Database,
  id: string
): Promise<RunConsolidation | null> {
  const row = await db
    .prepare(`SELECT * FROM run_consolidations WHERE id = ?`)
    .bind(id)
    .first();
  return row ? mapConsolidationRow(row) : null;
}

function mapConsolidationRow(row: Record<string, unknown>): RunConsolidation {
  let inputRunIds: string[] = [];
  try {
    const parsed = JSON.parse((row.input_run_ids_json as string) || '[]');
    if (Array.isArray(parsed)) {
      inputRunIds = parsed.filter((v): v is string => typeof v === 'string');
    }
  } catch { /* leave empty */ }

  let inputSnapshotIds: Record<string, string[]> = {};
  try {
    const parsed = JSON.parse((row.input_snapshot_ids_json as string) || '{}');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      for (const [key, val] of Object.entries(parsed)) {
        if (Array.isArray(val)) {
          inputSnapshotIds[key] = val.filter(
            (v): v is string => typeof v === 'string'
          );
        }
      }
    }
  } catch { /* leave empty */ }

  const VALID_PROPOSAL_TYPES = new Set(['source', 'threshold', 'topic', 'keyword', 'competitor']);
  const VALID_PROPOSAL_ACTIONS = new Set(['add', 'remove', 'adjust', 'investigate']);
  const VALID_CONFIDENCE = new Set(['high', 'medium', 'low']);

  let aiProposals: ConsolidationProposal[] = [];
  try {
    const parsed = JSON.parse((row.ai_proposals_json as string) || '[]');
    if (Array.isArray(parsed)) {
      for (const p of parsed) {
        if (typeof p !== 'object' || p === null) continue;
        const type = String(p.type ?? '');
        const action = String(p.action ?? '');
        const confidence = String(p.confidence ?? '');
        const priority = String(p.priority ?? '');
        if (
          !VALID_PROPOSAL_TYPES.has(type) ||
          !VALID_PROPOSAL_ACTIONS.has(action) ||
          !VALID_CONFIDENCE.has(confidence) ||
          !VALID_CONFIDENCE.has(priority)
        ) {
          continue; // drop proposals with invalid discriminants
        }
        aiProposals.push({
          type: type as ConsolidationProposal['type'],
          action: action as ConsolidationProposal['action'],
          target: String(p.target ?? ''),
          rationale: String(p.rationale ?? ''),
          confidence: confidence as ConsolidationProposal['confidence'],
          priority: priority as ConsolidationProposal['priority'],
        });
      }
    }
  } catch { /* leave empty */ }

  let aiTokenUsage: Record<string, number> | null = null;
  try {
    const parsed = JSON.parse((row.ai_token_usage_json as string) || 'null');
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const normalized: Record<string, number> = {};
      for (const [key, val] of Object.entries(parsed)) {
        const n = Number(val);
        if (Number.isFinite(n)) {
          normalized[key] = n;
        }
      }
      aiTokenUsage = normalized;
    }
  } catch { /* leave null */ }

  return {
    id: row.id as string,
    windowStart: row.window_start as string,
    windowEnd: row.window_end as string,
    status: row.status as ConsolidationStatus,
    attemptCount: Number(row.attempt_count ?? 0),
    startedAt: row.started_at as string,
    updatedAt: row.updated_at as string,
    completedAt: (row.completed_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    inputRunIds,
    inputSnapshotIds,
    contextBlobKey: (row.context_blob_key as string | null) ?? null,
    contextTokenEstimate: nullableNumber(row.context_token_estimate),
    aiModel: (row.ai_model as string | null) ?? null,
    aiOutputBlobKey: (row.ai_output_blob_key as string | null) ?? null,
    aiSummary: (row.ai_summary as string | null) ?? null,
    aiProposals,
    aiTokenUsage,
  };
}

// -- top articles by views (Phase 2 aggregation) --

export async function listTopArticleViewsAggregated(
  db: D1Database,
  fromDate: string,
  toDate: string,
  limit = 20
): Promise<TopArticleByViews[]> {
  const result = await db
    .prepare(
      `SELECT a.id, a.title, a.headline, a.relevance_score, a.tags,
              SUM(av.views) AS total_views
       FROM article_views av
       JOIN articles a ON av.article_id = a.id
       WHERE av.view_date >= ? AND av.view_date < ?
       GROUP BY av.article_id
       ORDER BY total_views DESC, a.id ASC
       LIMIT ?`
    )
    .bind(fromDate, toDate, limit)
    .all();
  return result.results.map((row) => {
    let tags: string[] = [];
    try {
      const parsed = JSON.parse((row.tags as string) || '[]');
      if (Array.isArray(parsed)) {
        tags = parsed.filter((v): v is string => typeof v === 'string');
      }
    } catch { /* leave empty */ }
    return {
      articleId: row.id as string,
      title: row.title as string,
      headline: (row.headline as string | null) ?? null,
      relevanceScore: nullableNumber(row.relevance_score),
      tags,
      totalViews: Number(row.total_views ?? 0),
    };
  });
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
