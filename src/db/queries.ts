import type { Article, SourceConfig, ScoredArticle, SourceType, Company } from '../types';

/** Escape SQL LIKE wildcards in user-provided values. */
function escapeLike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function insertArticle(
  db: D1Database,
  article: Omit<Article, 'isPublished'> & { isPublished?: boolean }
): Promise<void> {
  await db
    .prepare(
      `INSERT OR IGNORE INTO articles
       (id, url, title, source_type, source_name, author, published_at, fetched_at,
        content_snippet, image_url, relevance_score, quality_score, social_score,
        comment_count, company_mentions, ai_summary, tags, is_published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      article.id,
      article.url,
      article.title,
      article.sourceType,
      article.sourceName,
      article.author,
      article.publishedAt,
      article.fetchedAt,
      article.contentSnippet,
      article.imageUrl,
      article.relevanceScore,
      article.qualityScore ?? null,
      article.socialScore ?? null,
      article.commentCount ?? null,
      JSON.stringify(article.companyMentions ?? []),
      article.aiSummary,
      JSON.stringify(article.tags),
      article.isPublished !== false ? 1 : 0
    )
    .run();
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
  const { limit = 20, offset = 0, minScore = 40 } = options;
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
       WHERE is_published = 1 AND relevance_score >= 40
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
  companyMentions?: string[]
): Promise<void> {
  await db
    .prepare(
      `UPDATE articles SET relevance_score = ?, ai_summary = ?, tags = ?, is_published = ?, scored_at = ?,
       quality_score = COALESCE(?, quality_score), company_mentions = COALESCE(?, company_mentions)
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
      url
    )
    .run();
}

export async function getArticleCount(
  db: D1Database,
  minScore: number = 40
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
       WHERE is_published = 1 AND relevance_score >= 40 AND tags LIKE ?`
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
       WHERE is_published = 1 AND relevance_score >= 40 AND tags IS NOT NULL`
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
       WHERE is_published = 1 AND relevance_score >= 40
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
    sourceType: row.source_type as SourceType,
    sourceName: row.source_name as string,
    author: (row.author as string) || null,
    publishedAt: row.published_at as string,
    fetchedAt: row.fetched_at as string,
    contentSnippet: (row.content_snippet as string) || null,
    imageUrl: (row.image_url as string) || null,
    relevanceScore: row.relevance_score as number | null,
    qualityScore: (row.quality_score as number | null) ?? null,
    socialScore: (row.social_score as number | null) ?? null,
    commentCount: (row.comment_count as number | null) ?? null,
    companyMentions,
    aiSummary: (row.ai_summary as string) || null,
    tags,
    isPublished: row.is_published === 1,
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
