import type {
  Article,
  SourceConfig,
  ScoredArticle,
  SourceType,
  InsightSummary,
  InsightPeriodType,
  CompanyInsight,
  PipelineRun,
  PipelineRunRetrospective,
  PipelineRunStep,
  RunStepReport,
  RunStatus,
  RunTriggerType,
  RunWorkflowName,
  RunWorkflowStatus,
  RunRetrospectiveStatus,
} from '../types';
import { MIN_PUBLISH_SCORE } from '../scoring/classifier';

/** Escape SQL LIKE wildcards in user-provided values. */
function escapeLike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function getArticleByUrl(
  db: D1Database,
  url: string
): Promise<Article | null> {
  const row = await db
    .prepare('SELECT * FROM articles WHERE url = ?')
    .bind(url)
    .first();
  return row ? mapRowToArticle(row) : null;
}

export async function getPublishedArticles(
  db: D1Database,
  options: { limit?: number; offset?: number; minScore?: number } = {}
): Promise<Article[]> {
  const { limit = 20, offset = 0, minScore = MIN_PUBLISH_SCORE } = options;
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= ?
       ORDER BY (relevance_score * 0.5 + COALESCE(quality_score, 0) * 0.3 +
         CASE WHEN julianday('now') - julianday(published_at) < 1 THEN 20
              WHEN julianday('now') - julianday(published_at) < 3 THEN 10
              WHEN julianday('now') - julianday(published_at) < 7 THEN 5
              ELSE 0 END +
         CASE WHEN COALESCE(social_score, 0) > 100 THEN 10
              WHEN COALESCE(social_score, 0) > 10 THEN 5
              ELSE 0 END) DESC
       LIMIT ? OFFSET ?`
    )
    .bind(minScore, limit, offset)
    .all();
  return results.results.map(mapRowToArticle);
}

export async function getArticlesByTag(
  db: D1Database,
  tag: string,
  options: { limit?: number; offset?: number } = {}
): Promise<Article[]> {
  const { limit = 20, offset = 0 } = options;
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= 50
         AND tags LIKE ?
       ORDER BY published_at DESC
       LIMIT ? OFFSET ?`
    )
    .bind(`%"${escapeLike(tag)}"%`, limit, offset)
    .all();
  return results.results.map(mapRowToArticle);
}

export async function getFeaturedArticles(
  db: D1Database,
  limit: number = 5
): Promise<Article[]> {
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= 70
         AND (quality_score >= 50 OR quality_score IS NULL)
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.results.map(mapRowToArticle);
}

export async function getUnscoredArticles(
  db: D1Database,
  limit: number = 50
): Promise<Article[]> {
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE scored_at IS NULL
       ORDER BY fetched_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.results.map(mapRowToArticle);
}

export async function updateArticleScore(
  db: D1Database,
  url: string,
  score: number,
  aiSummary: string,
  tags: string[],
  isPublished: boolean,
  qualityScore?: number | null,
  companyMentions?: string[],
  headline?: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE articles SET relevance_score = ?, ai_summary = ?, tags = ?, is_published = ?, scored_at = ?,
       quality_score = COALESCE(?, quality_score), company_mentions = COALESCE(?, company_mentions),
       headline = COALESCE(?, headline)
       WHERE url = ?`
    )
    .bind(
      score,
      aiSummary,
      JSON.stringify(tags),
      isPublished ? 1 : 0,
      new Date().toISOString(),
      qualityScore ?? null,
      companyMentions ? JSON.stringify(companyMentions) : null,
      headline ?? null,
      url
    )
    .run();
}

export async function getArticleCount(
  db: D1Database,
  minScore: number = MIN_PUBLISH_SCORE
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT COUNT(*) as count FROM articles WHERE is_published = 1 AND relevance_score >= ?'
    )
    .bind(minScore)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getTotalArticleCount(
  db: D1Database
): Promise<number> {
  const row = await db
    .prepare('SELECT COUNT(*) as count FROM articles')
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function getArticleCountByTag(
  db: D1Database,
  tag: string
): Promise<number> {
  const row = await db
    .prepare(
      `SELECT COUNT(*) as count FROM articles
       WHERE is_published = 1 AND relevance_score >= 50 AND tags LIKE ?`
    )
    .bind(`%"${escapeLike(tag)}"%`)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function updateSource(
  db: D1Database,
  id: string,
  updates: { lastFetchedAt?: string; errorCount?: number; isActive?: boolean }
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (updates.lastFetchedAt !== undefined) {
    sets.push('last_fetched_at = ?');
    values.push(updates.lastFetchedAt);
  }
  if (updates.errorCount !== undefined) {
    sets.push('error_count = ?');
    values.push(updates.errorCount);
  }
  if (updates.isActive !== undefined) {
    sets.push('is_active = ?');
    values.push(updates.isActive ? 1 : 0);
  }
  if (sets.length === 0) return;
  values.push(id);
  await db
    .prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function getAllActiveSources(
  db: D1Database
): Promise<SourceConfig[]> {
  const results = await db
    .prepare('SELECT * FROM sources WHERE is_active = 1')
    .all();
  return results.results.map(mapRowToSource);
}

export async function getAllUniqueTags(db: D1Database): Promise<string[]> {
  const results = await db
    .prepare(
      `SELECT DISTINCT tags FROM articles
       WHERE is_published = 1 AND relevance_score >= 50 AND tags IS NOT NULL`
    )
    .all();
  const tagSet = new Set<string>();
  for (const row of results.results) {
    try {
      const tags = JSON.parse(row.tags as string) as string[];
      tags.forEach((t) => tagSet.add(t));
    } catch {
      // skip malformed tags
    }
  }
  return Array.from(tagSet).sort();
}

export async function getCompanyArticles(
  db: D1Database,
  companyName: string,
  limit: number = 20
): Promise<Article[]> {
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= 50
         AND company_mentions LIKE ?
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .bind(`%"${escapeLike(companyName)}"%`, limit)
    .all();
  return results.results.map(mapRowToArticle);
}

/**
 * Fetch all articles linked to companies via the junction table,
 * grouped by company ID. Returns a Map<companyId, Article[]>.
 */
export async function getAllCompanyArticles(
  db: D1Database,
  limitPerCompany: number = 50
): Promise<Map<string, Article[]>> {
  const results = await db
    .prepare(
      `SELECT ac.company_id, a.* FROM article_companies ac
       JOIN articles a ON a.id = ac.article_id
       ORDER BY a.published_at DESC
       LIMIT 2500`
    )
    .all();

  const map = new Map<string, Article[]>();
  for (const row of results.results) {
    const companyId = row.company_id as string;
    const article = mapRowToArticle(row);
    if (!map.has(companyId)) map.set(companyId, []);
    const articles = map.get(companyId)!;
    if (articles.length < limitPerCompany) articles.push(article);
  }
  return map;
}


export async function getArticleById(
  db: D1Database,
  id: string
): Promise<Article | null> {
  const row = await db
    .prepare('SELECT * FROM articles WHERE id = ? AND is_published = 1')
    .bind(id)
    .first();
  return row ? mapRowToArticle(row) : null;
}

export async function getRelatedArticles(
  db: D1Database,
  article: Article,
  limit: number = 5
): Promise<Article[]> {
  // Find articles sharing the same tags
  if (article.tags.length === 0) return [];

  const tagConditions = article.tags
    .slice(0, 3)  // Use up to 3 tags
    .map(() => `tags LIKE ?`)
    .join(' OR ');
  const tagBindings = article.tags
    .slice(0, 3)
    .map(t => `%"${escapeLike(t)}"%`);

  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= ?
         AND id != ?
         AND (${tagConditions})
       ORDER BY published_at DESC
       LIMIT ?`
    )
    .bind(MIN_PUBLISH_SCORE, article.id, ...tagBindings, limit)
    .all();
  return results.results.map(mapRowToArticle);
}

function mapRowToArticle(row: Record<string, unknown>): Article {
  let tags: string[] = [];
  try {
    tags = JSON.parse((row.tags as string) || '[]');
  } catch {
    tags = [];
  }
  let companyMentions: string[] = [];
  try {
    companyMentions = JSON.parse((row.company_mentions as string) || '[]');
  } catch {
    companyMentions = [];
  }
  return {
    id: row.id as string,
    url: row.url as string,
    title: row.title as string,
    headline: (row.headline as string) || null,
    sourceType: row.source_type as SourceType,
    sourceName: row.source_name as string,
    author: (row.author as string) || null,
    publishedAt: row.published_at as string,
    fetchedAt: row.fetched_at as string,
    contentSnippet: (row.content_snippet as string) || null,
    imageUrl: (row.image_url as string) || null,
    relevanceScore: row.relevance_score as number | null,
    qualityScore: row.quality_score as number | null,
    aiSummary: (row.ai_summary as string) || null,
    tags,
    isPublished: row.is_published === 1,
    socialScore: row.social_score as number | null,
    commentCount: row.comment_count as number | null,
    companyMentions,
    transcript: (row.transcript as string) || null,
    transcriptSummary: (row.transcript_summary as string) || null,
  };
}

function mapRowToSource(row: Record<string, unknown>): SourceConfig {
  let config: Record<string, string> = {};
  try {
    config = JSON.parse((row.config as string) || '{}');
  } catch {
    config = {};
  }
  return {
    id: row.id as string,
    sourceType: row.source_type as SourceType,
    name: row.name as string,
    config,
    isActive: row.is_active === 1,
    lastFetchedAt: (row.last_fetched_at as string) || null,
    errorCount: (row.error_count as number) || 0,
  };
}

// -- Summaries (InsightSummary) queries --

function mapRowToSummary(row: Record<string, unknown>): InsightSummary {
  let topArticleIds: string[] = [];
  try {
    topArticleIds = JSON.parse((row.top_article_ids as string) || '[]');
  } catch {
    topArticleIds = [];
  }
  return {
    id: row.id as string,
    periodType: row.period_type as InsightPeriodType,
    periodStart: row.period_start as string,
    periodEnd: row.period_end as string,
    title: row.title as string,
    content: row.content as string,
    contentHtml: row.content_html as string,
    articleCount: row.article_count as number,
    topArticleIds,
    generatedAt: row.generated_at as string,
  };
}

export async function insertSummary(
  db: D1Database,
  summary: InsightSummary
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO summaries
       (id, period_type, period_start, period_end, title, content, content_html,
        article_count, top_article_ids, generated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      summary.id,
      summary.periodType,
      summary.periodStart,
      summary.periodEnd,
      summary.title,
      summary.content,
      summary.contentHtml,
      summary.articleCount,
      JSON.stringify(summary.topArticleIds),
      summary.generatedAt
    )
    .run();
}

export async function summaryExistsForPeriod(
  db: D1Database,
  periodType: InsightPeriodType,
  periodStart: string
): Promise<boolean> {
  const row = await db
    .prepare(
      'SELECT 1 as exists_flag FROM summaries WHERE period_type = ? AND period_start = ? LIMIT 1'
    )
    .bind(periodType, periodStart)
    .first<{ exists_flag: number }>();
  return row !== null;
}

export async function getLatestSummaries(
  db: D1Database
): Promise<InsightSummary[]> {
  const results = await db
    .prepare(
      `SELECT s.* FROM summaries s
       INNER JOIN (
         SELECT period_type, MAX(period_start) as max_start
         FROM summaries
         GROUP BY period_type
       ) latest ON s.period_type = latest.period_type AND s.period_start = latest.max_start
       ORDER BY CASE s.period_type
         WHEN 'hourly' THEN 1
         WHEN 'daily' THEN 2
         WHEN 'weekly' THEN 3
         WHEN 'monthly' THEN 4
         WHEN 'quarterly' THEN 5
         ELSE 6
       END`
    )
    .all();
  return results.results.map(mapRowToSummary);
}

export async function getSummariesByType(
  db: D1Database,
  periodType: InsightPeriodType,
  options: { limit?: number; offset?: number } = {}
): Promise<InsightSummary[]> {
  const { limit = 20, offset = 0 } = options;
  const results = await db
    .prepare(
      `SELECT * FROM summaries
       WHERE period_type = ?
       ORDER BY period_start DESC
       LIMIT ? OFFSET ?`
    )
    .bind(periodType, limit, offset)
    .all();
  return results.results.map(mapRowToSummary);
}

export async function getArticlesInRange(
  db: D1Database,
  start: string,
  end: string,
  limit: number = 100
): Promise<Article[]> {
  const results = await db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1 AND relevance_score >= 50
         AND published_at >= ? AND published_at < ?
       ORDER BY relevance_score DESC, published_at DESC
       LIMIT ?`
    )
    .bind(start, end, limit)
    .all();
  return results.results.map(mapRowToArticle);
}

export async function getAllRecentSummaries(
  db: D1Database,
  limit: number = 200
): Promise<InsightSummary[]> {
  const results = await db
    .prepare(
      `SELECT * FROM summaries
       ORDER BY period_start DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.results.map(mapRowToSummary);
}

// -- Company Insights queries --

export async function getCompanyInsight(
  db: D1Database,
  companyId: string
): Promise<CompanyInsight | null> {
  const row = await db
    .prepare(
      `SELECT * FROM company_insights
       WHERE company_id = ?
       ORDER BY generated_at DESC
       LIMIT 1`
    )
    .bind(companyId)
    .first();
  return row ? mapRowToCompanyInsight(row) : null;
}

export async function getAllCompanyInsights(
  db: D1Database
): Promise<Map<string, CompanyInsight>> {
  const results = await db
    .prepare('SELECT * FROM company_insights')
    .all();
  const map = new Map<string, CompanyInsight>();
  for (const row of results.results) {
    const insight = mapRowToCompanyInsight(row);
    map.set(insight.companyId, insight);
  }
  return map;
}

export async function upsertCompanyInsight(
  db: D1Database,
  insight: CompanyInsight
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO company_insights (id, company_id, content, content_html, article_count, generated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(company_id) DO UPDATE SET
         id = excluded.id,
         content = excluded.content,
         content_html = excluded.content_html,
         article_count = excluded.article_count,
         generated_at = excluded.generated_at`
    )
    .bind(
      insight.id,
      insight.companyId,
      insight.content,
      insight.contentHtml,
      insight.articleCount,
      insight.generatedAt
    )
    .run();
}

function mapRowToCompanyInsight(row: Record<string, unknown>): CompanyInsight {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    content: row.content as string,
    contentHtml: row.content_html as string,
    articleCount: (row.article_count as number) || 0,
    generatedAt: row.generated_at as string,
  };
}

// -- Pipeline run telemetry queries --

function workflowColumnPrefix(workflowName: RunWorkflowName): 'collect' | 'process' {
  return workflowName === 'collect' ? 'collect' : 'process';
}

function parseJsonArray(value: unknown): string[] {
  try {
    const parsed = JSON.parse((value as string) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown): Record<string, string | number | boolean | null> {
  try {
    const parsed = JSON.parse((value as string) || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }

    const entries = Object.entries(parsed).filter(([, entryValue]) => (
      entryValue === null ||
      typeof entryValue === 'string' ||
      typeof entryValue === 'number' ||
      typeof entryValue === 'boolean'
    ));
    return Object.fromEntries(entries) as Record<string, string | number | boolean | null>;
  } catch {
    return {};
  }
}

function mapRowToPipelineRun(row: Record<string, unknown>): PipelineRun {
  return {
    id: row.id as string,
    triggerType: row.trigger_type as RunTriggerType,
    triggerSource: row.trigger_source as string,
    startedAt: row.started_at as string,
    completedAt: (row.completed_at as string) || null,
    status: row.status as RunStatus,
    collectWorkflowId: (row.collect_workflow_id as string) || null,
    collectStartedAt: (row.collect_started_at as string) || null,
    collectCompletedAt: (row.collect_completed_at as string) || null,
    collectStatus: row.collect_status as RunWorkflowStatus,
    processWorkflowId: (row.process_workflow_id as string) || null,
    processStartedAt: (row.process_started_at as string) || null,
    processCompletedAt: (row.process_completed_at as string) || null,
    processStatus: row.process_status as RunWorkflowStatus,
    retrospectiveStatus: row.retrospective_status as RunRetrospectiveStatus,
    retrospectiveSummary: (row.retrospective_summary as string) || null,
    retrospectiveWentWell: parseJsonArray(row.retrospective_went_well),
    retrospectiveDidntGoWell: parseJsonArray(row.retrospective_didnt_go_well),
    retrospectiveFollowUps: parseJsonArray(row.retrospective_follow_ups),
    retrospectiveGeneratedAt: (row.retrospective_generated_at as string) || null,
    retrospectiveError: (row.retrospective_error as string) || null,
  };
}

function mapRowToPipelineRunStep(row: Record<string, unknown>): PipelineRunStep {
  return {
    pipelineRunId: row.pipeline_run_id as string,
    workflowName: row.workflow_name as RunWorkflowName,
    stepName: row.step_name as string,
    status: row.status as RunStepReport['status'],
    startedAt: row.started_at as string,
    completedAt: row.completed_at as string,
    metrics: parseJsonObject(row.metrics_json),
    notes: parseJsonArray(row.notes_json),
    errors: parseJsonArray(row.errors_json),
  };
}

export async function markPipelineWorkflowStarted(
  db: D1Database,
  params: {
    runId: string;
    triggerType: RunTriggerType;
    triggerSource: string;
    runStartedAt: string;
    workflowName: RunWorkflowName;
    workflowId: string;
    workflowStartedAt: string;
  }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO pipeline_runs
       (id, trigger_type, trigger_source, started_at, status)
       VALUES (?, ?, ?, ?, 'running')`
    )
    .bind(
      params.runId,
      params.triggerType,
      params.triggerSource,
      params.runStartedAt
    )
    .run();

  const prefix = workflowColumnPrefix(params.workflowName);
  await db
    .prepare(
      `UPDATE pipeline_runs
       SET ${prefix}_workflow_id = COALESCE(${prefix}_workflow_id, ?),
           ${prefix}_started_at = COALESCE(${prefix}_started_at, ?),
           ${prefix}_status = 'running'
       WHERE id = ?`
    )
    .bind(params.workflowId, params.workflowStartedAt, params.runId)
    .run();
}

export async function recordPipelineRunStep(
  db: D1Database,
  runId: string,
  workflowName: RunWorkflowName,
  step: RunStepReport
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO pipeline_run_steps
       (pipeline_run_id, workflow_name, step_name, status, started_at, completed_at, metrics_json, notes_json, errors_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(pipeline_run_id, workflow_name, step_name) DO UPDATE SET
         status = excluded.status,
         started_at = excluded.started_at,
         completed_at = excluded.completed_at,
         metrics_json = excluded.metrics_json,
         notes_json = excluded.notes_json,
         errors_json = excluded.errors_json`
    )
    .bind(
      runId,
      workflowName,
      step.stepName,
      step.status,
      step.startedAt,
      step.completedAt,
      JSON.stringify(step.metrics ?? {}),
      JSON.stringify(step.notes ?? []),
      JSON.stringify(step.errors ?? [])
    )
    .run();
}

export async function finishPipelineWorkflow(
  db: D1Database,
  params: {
    runId: string;
    workflowName: RunWorkflowName;
    status: RunWorkflowStatus;
    completedAt: string;
  }
): Promise<void> {
  const prefix = workflowColumnPrefix(params.workflowName);
  await db
    .prepare(
      `UPDATE pipeline_runs
       SET ${prefix}_status = ?, ${prefix}_completed_at = ?
       WHERE id = ?`
    )
    .bind(params.status, params.completedAt, params.runId)
    .run();
}

export async function updatePipelineRunStatus(
  db: D1Database,
  runId: string,
  status: RunStatus,
  completedAt?: string | null
): Promise<void> {
  await db
    .prepare(
      `UPDATE pipeline_runs
       SET status = ?, completed_at = COALESCE(?, completed_at)
       WHERE id = ?`
    )
    .bind(status, completedAt ?? null, runId)
    .run();
}

export async function getPipelineRunById(
  db: D1Database,
  id: string
): Promise<PipelineRun | null> {
  const row = await db
    .prepare('SELECT * FROM pipeline_runs WHERE id = ?')
    .bind(id)
    .first();
  return row ? mapRowToPipelineRun(row) : null;
}

export async function getPipelineRunSteps(
  db: D1Database,
  runId: string
): Promise<PipelineRunStep[]> {
  const results = await db
    .prepare(
      `SELECT * FROM pipeline_run_steps
       WHERE pipeline_run_id = ?
       ORDER BY workflow_name ASC, completed_at ASC, step_name ASC`
    )
    .bind(runId)
    .all();
  return results.results.map(mapRowToPipelineRunStep);
}

export async function listPipelineRuns(
  db: D1Database,
  limit: number = 20
): Promise<PipelineRun[]> {
  const results = await db
    .prepare(
      `SELECT * FROM pipeline_runs
       ORDER BY started_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.results.map(mapRowToPipelineRun);
}

export async function claimPipelineRunRetrospective(
  db: D1Database,
  runId: string
): Promise<boolean> {
  const result = await db
    .prepare(
      `UPDATE pipeline_runs
       SET retrospective_status = 'generating', retrospective_error = NULL
       WHERE id = ?
         AND retrospective_status IN ('pending', 'failed')
         AND collect_status IN ('complete', 'warning', 'error')
         AND process_status IN ('complete', 'warning', 'error')`
    )
    .bind(runId)
    .run();
  return result.meta.changes > 0;
}

export async function savePipelineRunRetrospective(
  db: D1Database,
  runId: string,
  retrospective: PipelineRunRetrospective
): Promise<void> {
  await db
    .prepare(
      `UPDATE pipeline_runs
       SET retrospective_status = 'complete',
           retrospective_summary = ?,
           retrospective_went_well = ?,
           retrospective_didnt_go_well = ?,
           retrospective_follow_ups = ?,
           retrospective_generated_at = ?,
           retrospective_error = NULL
       WHERE id = ?`
    )
    .bind(
      retrospective.summary,
      JSON.stringify(retrospective.wentWell),
      JSON.stringify(retrospective.didntGoWell),
      JSON.stringify(retrospective.followUps),
      retrospective.generatedAt,
      runId
    )
    .run();
}

export async function failPipelineRunRetrospective(
  db: D1Database,
  runId: string,
  error: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE pipeline_runs
       SET retrospective_status = 'failed',
           retrospective_error = ?
       WHERE id = ?`
    )
    .bind(error, runId)
    .run();
}
