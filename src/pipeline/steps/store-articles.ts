/**
 * Pipeline step: persist batched articles + source-status updates.
 *
 * Two-phase work:
 *  1. Batch UPDATE on sources (last_fetched_at, error_count) for every
 *     source that was attempted in the batch.
 *  2. Dedup against existing article URLs in 100-row IN-clauses, then
 *     INSERT OR IGNORE the survivors in 50-row D1 batches.
 *
 * Result includes the URL list of newly inserted articles so later
 * pipeline steps can scope their work to "what actually changed."
 */

import type { CollectedArticle, Env } from '../../types';
import type { StepOutcome } from '../step-runner';

export interface StoreArticlesResult {
  collected: number;
  fresh: number;
  inserted: number;
  sourceCount: number;
  sourceUpdateFailed: boolean;
  dedupFailed: boolean;
  insertFailures: number;
  /** URLs of articles that were newly inserted this run. */
  insertedUrls: string[];
}

export type SourceUpdate = {
  id: string;
  lastFetchedAt?: string;
  errorCount: number;
};

function generateId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function storeArticlesStep(
  env: Env,
  allCollected: CollectedArticle[],
  allSourceUpdates: SourceUpdate[],
  sourceCount: number
): Promise<StepOutcome<StoreArticlesResult>> {
  let sourceUpdateFailed = false;
  let dedupFailed = false;
  let insertFailures = 0;

  if (allSourceUpdates.length > 0) {
    try {
      const stmts = allSourceUpdates.map((sourceUpdate) => {
        if (sourceUpdate.lastFetchedAt) {
          return env.DB.prepare(
            'UPDATE sources SET last_fetched_at = ?, error_count = ? WHERE id = ?'
          ).bind(
            sourceUpdate.lastFetchedAt,
            sourceUpdate.errorCount,
            sourceUpdate.id
          );
        }
        return env.DB.prepare(
          'UPDATE sources SET error_count = ? WHERE id = ?'
        ).bind(sourceUpdate.errorCount, sourceUpdate.id);
      });
      await env.DB.batch(stmts);
    } catch (err) {
      sourceUpdateFailed = true;
      console.error('Batch source update failed:', err);
    }
  }

  let newArticles: CollectedArticle[] = allCollected;
  try {
    const urls = allCollected.map((article) => article.url);
    const existingUrls = new Set<string>();
    for (let i = 0; i < urls.length; i += 100) {
      const batch = urls.slice(i, i + 100);
      const placeholders = batch.map(() => '?').join(',');
      const result = await env.DB.prepare(
        `SELECT url FROM articles WHERE url IN (${placeholders})`
      )
        .bind(...batch)
        .all();
      for (const row of result.results) {
        existingUrls.add(row.url as string);
      }
    }
    newArticles = allCollected.filter(
      (article) => !existingUrls.has(article.url)
    );
  } catch (err) {
    dedupFailed = true;
    console.error('Dedup query failed, treating all as new:', err);
  }
  console.log(`New articles after dedup: ${newArticles.length}`);

  // Drop future-dated articles — bad data from a few feeds.
  const now = new Date();
  const validArticles = newArticles.filter((article) => {
    try {
      const pubDate = new Date(article.publishedAt);
      if (pubDate > now) {
        console.warn(
          `Skipping future-dated article: ${article.url} (published: ${article.publishedAt})`
        );
        return false;
      }
      return true;
    } catch {
      console.warn(
        `Skipping article with invalid date: ${article.url} (published: ${article.publishedAt})`
      );
      return false;
    }
  });
  const skippedFutureCount = newArticles.length - validArticles.length;
  if (skippedFutureCount > 0) {
    console.log(`Skipped ${skippedFutureCount} future-dated articles`);
  }

  let insertedCount = 0;
  const insertedUrls: string[] = [];
  const fetchedAt = nowIso();
  for (let i = 0; i < validArticles.length; i += 50) {
    const batch = validArticles.slice(i, i + 50);
    const stmts = batch.map((article) =>
      env.DB.prepare(
        `INSERT OR IGNORE INTO articles
         (id, url, title, source_type, source_name, author, published_at, fetched_at,
          content_snippet, image_url, relevance_score, quality_score, social_score,
          comment_count, company_mentions, ai_summary, tags, is_published, scored_at,
          transcript)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        generateId(),
        article.url,
        article.title,
        article.sourceType,
        article.sourceName,
        article.author,
        article.publishedAt,
        fetchedAt,
        article.contentSnippet,
        article.imageUrl,
        0,
        null,
        article.socialScore ?? null,
        article.commentCount ?? null,
        JSON.stringify([]),
        '',
        JSON.stringify([]),
        0,
        null,
        article.transcript ?? null
      )
    );

    try {
      await env.DB.batch(stmts);
      insertedCount += batch.length;
      for (const article of batch) insertedUrls.push(article.url);
    } catch (err) {
      insertFailures += batch.length;
      console.error(`Batch insert failed at offset ${i}:`, err);
    }
  }
  console.log(`Inserted ${insertedCount} articles into D1`);

  const notes: string[] = [];
  if (sourceUpdateFailed) {
    notes.push('Failed to persist one or more source status updates.');
  }
  if (dedupFailed) {
    notes.push('Dedup query failed, so all collected articles were treated as new.');
  }
  if (insertFailures > 0) {
    notes.push(`Failed to insert ${insertFailures} articles.`);
  }

  return {
    status: notes.length > 0 ? 'warning' : 'ok',
    metrics: {
      collected: allCollected.length,
      newArticles: newArticles.length,
      inserted: insertedCount,
      sources: sourceCount,
      insertFailures,
    },
    notes,
    result: {
      collected: allCollected.length,
      fresh: newArticles.length,
      inserted: insertedCount,
      sourceCount,
      sourceUpdateFailed,
      dedupFailed,
      insertFailures,
      insertedUrls,
    },
  };
}
