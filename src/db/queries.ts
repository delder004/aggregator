import type { Article, SourceConfig, ScoredArticle, SourceType, InsightSummary, InsightPeriodType } from '../types';
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
