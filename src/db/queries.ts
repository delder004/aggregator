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
       WHERE is_published = 1 AND relevance_score >= ? AND (quality_score >= 30 OR quality_score IS NULL)
         AND datetime(published_at) <= datetime('now')
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

/** A company hit from site search — only the fields the results page renders. */
export interface CompanySearchHit {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
}

/** A job hit from site search, with its owning company's name resolved. */
export interface JobSearchHit {
  title: string;
  companyId: string;
  companyName: string;
  location: string | null;
  isRemote: boolean;
  url: string;
}

export interface SiteSearchResults {
  articles: Article[];
  companies: CompanySearchHit[];
  jobs: JobSearchHit[];
}

/**
 * Full-corpus keyword search over published articles, tracked companies, and
 * open jobs. Substring (`LIKE`) match — see docs/search-feature-exploration.md
 * for why this (Option A) over FTS5 for now. Each result set is independently
 * limited so one busy corpus can't crowd out the others.
 */
export async function searchSite(
  db: D1Database,
  term: string,
  options: { articleLimit?: number; companyLimit?: number; jobLimit?: number } = {}
): Promise<SiteSearchResults> {
  const trimmed = term.trim();
  if (!trimmed) return { articles: [], companies: [], jobs: [] };

  const { articleLimit = 40, companyLimit = 20, jobLimit = 20 } = options;
  const like = `%${escapeLike(trimmed)}%`;

  // Articles: rank exact-ish title hits first, then by relevance/recency.
  const articlesP = db
    .prepare(
      `SELECT * FROM articles
       WHERE is_published = 1
         AND relevance_score >= ?
         AND datetime(published_at) <= datetime('now')
         AND (title LIKE ?2 ESCAPE '\\'
              OR headline LIKE ?2 ESCAPE '\\'
              OR ai_summary LIKE ?2 ESCAPE '\\'
              OR content_snippet LIKE ?2 ESCAPE '\\'
              OR company_mentions LIKE ?2 ESCAPE '\\'
              OR author LIKE ?2 ESCAPE '\\')
       ORDER BY
         (CASE WHEN title LIKE ?2 ESCAPE '\\'
                 OR headline LIKE ?2 ESCAPE '\\' THEN 1 ELSE 0 END) DESC,
         relevance_score DESC,
         published_at DESC
       LIMIT ?3`
    )
    .bind(MIN_PUBLISH_SCORE, like, articleLimit)
    .all();

  // Companies: only active, tracked companies.
  const companiesP = db
    .prepare(
      `SELECT id, name, description, category FROM companies
       WHERE is_active = 1
         AND (name LIKE ?1 ESCAPE '\\'
              OR aliases LIKE ?1 ESCAPE '\\'
              OR description LIKE ?1 ESCAPE '\\'
              OR category LIKE ?1 ESCAPE '\\')
       ORDER BY article_count DESC, name ASC
       LIMIT ?2`
    )
    .bind(like, companyLimit)
    .all();

  // Jobs: join the company so we can show & link the employer.
  const jobsP = db
    .prepare(
      `SELECT j.title AS title, j.location AS location, j.is_remote AS is_remote,
              j.url AS url, c.id AS company_id, c.name AS company_name
       FROM company_jobs j
       JOIN companies c ON c.id = j.company_id AND c.is_active = 1
       WHERE j.title LIKE ?1 ESCAPE '\\'
          OR j.location LIKE ?1 ESCAPE '\\'
          OR j.department LIKE ?1 ESCAPE '\\'
          OR c.name LIKE ?1 ESCAPE '\\'
       ORDER BY j.last_seen_at DESC
       LIMIT ?2`
    )
    .bind(like, jobLimit)
    .all();

  const [articlesRes, companiesRes, jobsRes] = await Promise.all([
    articlesP,
    companiesP,
    jobsP,
  ]);

  return {
    articles: articlesRes.results.map(mapRowToArticle),
    companies: companiesRes.results.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      description: (row.description as string) || null,
      category: (row.category as string) || null,
    })),
    jobs: jobsRes.results.map((row) => ({
      title: row.title as string,
      companyId: row.company_id as string,
      companyName: row.company_name as string,
      location: (row.location as string) || null,
      isRemote: row.is_remote === 1,
      url: row.url as string,
    })),
  };
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
         AND datetime(published_at) <= datetime('now')
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
         AND datetime(published_at) <= datetime('now')
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
      'SELECT COUNT(*) as count FROM articles WHERE is_published = 1 AND relevance_score >= ? AND (quality_score >= 30 OR quality_score IS NULL) AND datetime(published_at) <= datetime(\'now\')'
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
       WHERE is_published = 1 AND relevance_score >= 50 AND tags LIKE ?
         AND datetime(published_at) <= datetime('now')`
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

export async function getRecentlyScoredArticles(
  db: D1Database,
  since: string
): Promise<ScoredArticle[]> {
  const results = await db
    .prepare(
      'SELECT * FROM articles WHERE scored_at >= ? AND relevance_score > 0'
    )
    .bind(since)
    .all();
  return results.results.map((row) => ({
    url: row.url as string,
    title: row.title as string,
    sourceType: row.source_type as SourceType,
    sourceName: row.source_name as string,
    author: row.author as string | null,
    publishedAt: row.published_at as string,
    contentSnippet: row.content_snippet as string | null,
    imageUrl: row.image_url as string | null,
    relevanceScore: row.relevance_score as number,
    qualityScore: (row.quality_score as number) ?? 0,
    aiSummary: (row.ai_summary as string) ?? '',
    headline: (row.headline as string) ?? '',
    tags: JSON.parse((row.tags as string) || '[]'),
    companyMentions: JSON.parse((row.company_mentions as string) || '[]'),
    transcript: (row.transcript as string) || undefined,
  }));
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
         AND datetime(published_at) <= datetime('now')
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
       WHERE a.is_published = 1 AND a.relevance_score >= ?
         AND datetime(a.published_at) <= datetime('now')
       ORDER BY a.published_at DESC
       LIMIT 2500`
    )
    .bind(MIN_PUBLISH_SCORE)
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

export async function getArticleLinkedCompanies(
  db: D1Database,
  articleId: string
): Promise<{ id: string; name: string }[]> {
  const results = await db
    .prepare(
      `SELECT c.id, c.name FROM article_companies ac
       JOIN companies c ON c.id = ac.company_id
       WHERE ac.article_id = ?
       ORDER BY c.name ASC`
    )
    .bind(articleId)
    .all();
  return results.results.map(row => ({
    id: row.id as string,
    name: row.name as string,
  }));
}

export async function getRelatedArticles(
  db: D1Database,
  article: Article,
  limit: number = 5
): Promise<Article[]> {
  // Find articles sharing the same tags, ranked by topical relevance (tag overlap)
  // then recency. Using up to 5 tags surfaces more specific matches: an article
  // sharing "tax" + "automation" + "product-launch" ranks above one sharing only
  // the ubiquitous "agentic-ai" tag, so the "Continue reading" strip stays on-topic.
  if (article.tags.length === 0) return [];

  const tags = article.tags.slice(0, 5);
  const tagBindings = tags.map(t => `%"${escapeLike(t)}"%`);
  const tagConditions = tags.map(() => `tags LIKE ?`).join(' OR ');
  // COUNT how many of the article's tags each candidate shares
  const scoreExpr = tags.map(() => `(CASE WHEN tags LIKE ? THEN 1 ELSE 0 END)`).join(' + ');

  const results = await db
    .prepare(
      `SELECT *, (${scoreExpr}) as tag_overlap
       FROM articles
       WHERE is_published = 1 AND relevance_score >= ?
         AND id != ?
         AND (${tagConditions})
         AND datetime(published_at) <= datetime('now')
       ORDER BY tag_overlap DESC, published_at DESC
       LIMIT ?`
    )
    .bind(...tagBindings, MIN_PUBLISH_SCORE, article.id, ...tagBindings, limit)
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
         AND datetime(published_at) >= datetime(?) AND datetime(published_at) <= datetime(?)
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

export async function listPipelineRunsByDateRange(
  db: D1Database,
  from: string,
  to: string,
  limit: number = 200
): Promise<PipelineRun[]> {
  const results = await db
    .prepare(
      `SELECT * FROM pipeline_runs
       WHERE started_at >= ? AND started_at < ?
       ORDER BY started_at DESC
       LIMIT ?`
    )
    .bind(from, to, limit)
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

/** Clean up stale article-company links where the article is no longer published or below minimum score threshold. */
export async function cleanupStaleArticleCompanyLinks(
  db: D1Database
): Promise<number> {
  const result = await db
    .prepare(
      `DELETE FROM article_companies
       WHERE article_id NOT IN (
         SELECT id FROM articles
         WHERE is_published = 1 AND relevance_score >= ?
       )`
    )
    .bind(MIN_PUBLISH_SCORE)
    .run();
  const deletedCount = result.meta.changes ?? 0;

  // After cleanup, sync all company article_count values to match actual link counts.
  // This ensures stale counts don't appear on the site after articles are unpublished.
  if (deletedCount > 0) {
    await db
      .prepare(
        `UPDATE companies SET
           article_count = COALESCE((
             SELECT COUNT(*) FROM article_companies WHERE company_id = companies.id
           ), 0)
         WHERE is_active = 1`
      )
      .run();
  }

  return deletedCount;
}

/**
 * Sync curated company descriptions into the database.
 * Updates company records with descriptions from the curated list,
 * only if the company exists and currently has no description.
 */
export async function syncCuratedCompanyDescriptions(
  db: D1Database,
  curatedDescriptions: Record<string, string>
): Promise<number> {
  let updateCount = 0;

  // Batch updates in groups of 100 to avoid excessive subrequests
  const companyIds = Object.keys(curatedDescriptions);
  for (let i = 0; i < companyIds.length; i += 100) {
    const batch = companyIds.slice(i, i + 100);
    const updates: Array<{
      id: string;
      description: string;
    }> = [];

    // For each company in this batch, check if it exists and has no description
    const placeholders = batch.map(() => '?').join(',');
    const result = await db
      .prepare(`SELECT id, description FROM companies WHERE id IN (${placeholders})`)
      .bind(...batch)
      .all();

    for (const row of result.results) {
      const companyId = row.id as string;
      // Only update if description is NULL or empty
      if (!row.description || row.description === '') {
        const curatedDesc = curatedDescriptions[companyId];
        if (curatedDesc) {
          updates.push({ id: companyId, description: curatedDesc });
        }
      }
    }

    // Execute batch updates
    if (updates.length > 0) {
      const updateStmts = updates.map((item) =>
        db
          .prepare(`UPDATE companies SET description = ? WHERE id = ?`)
          .bind(item.description, item.id)
      );
      await db.batch(updateStmts);
      updateCount += updates.length;
    }
  }

  return updateCount;
}
