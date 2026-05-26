/**
 * Pipeline step: score unscored articles with Haiku.
 *
 * Reads up to maxPerRun unscored rows from D1, calls the classifier in
 * parallel chunks, then writes the scored fields (relevance, quality,
 * tags, summary, headline, mentions) back to D1 in one batch. Also
 * extracts a websiteHints map (company-name → website) from the enriched
 * mentions, which the company-enrichment step consumes for blog probing.
 *
 * Returns scoredUrls so downstream steps can scope work to "what just
 * changed" rather than re-touching everything.
 */

import type { Env, ScoredArticle } from '../../types';
import { getUnscoredArticles } from '../../db/queries';
import { scoreArticles, MIN_PUBLISH_SCORE } from '../../scoring/classifier';
import type { StepOutcome } from '../step-runner';

export interface ScoreArticlesResult {
  scored: number;
  candidates: number;
  websiteHints: Record<string, string>;
  skipped: boolean;
  scoredUrls: string[];
  error?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function scoreArticlesStep(
  env: Env,
  maxPerRun: number
): Promise<StepOutcome<ScoreArticlesResult>> {
  try {
    const unscoredFromDb = await getUnscoredArticles(env.DB, maxPerRun);
    if (unscoredFromDb.length === 0) {
      console.log('No unscored articles to score');
      return {
        status: 'skipped',
        metrics: { candidates: 0, scored: 0 },
        notes: ['No unscored articles were available.'],
        result: {
          scored: 0,
          candidates: 0,
          websiteHints: {},
          skipped: true,
          scoredUrls: [],
        },
      };
    }

    console.log(`Scoring ${unscoredFromDb.length} unscored articles`);
    const scoreInput = unscoredFromDb.map((article) => ({
      url: article.url,
      title: article.title,
      sourceType: article.sourceType,
      sourceName: article.sourceName,
      author: article.author,
      publishedAt: article.publishedAt,
      contentSnippet: article.contentSnippet,
      imageUrl: article.imageUrl,
      transcript: article.transcript ?? undefined,
    }));
    const scored = await scoreArticles(scoreInput, env);
    const scoredAt = nowIso();
    const updateStmts = scored.map((article: ScoredArticle) =>
      env.DB.prepare(
        `UPDATE articles SET relevance_score = ?, ai_summary = ?, tags = ?, is_published = ?, scored_at = ?,
         quality_score = COALESCE(?, quality_score), company_mentions = COALESCE(?, company_mentions),
         headline = COALESCE(?, headline), transcript_summary = COALESCE(?, transcript_summary)
         WHERE url = ?`
      ).bind(
        article.relevanceScore,
        article.aiSummary,
        JSON.stringify(article.tags),
        article.relevanceScore >= MIN_PUBLISH_SCORE &&
          (article.qualityScore === null || article.qualityScore >= 30)
          ? 1
          : 0,
        scoredAt,
        article.qualityScore ?? null,
        article.companyMentions
          ? JSON.stringify(article.companyMentions)
          : null,
        article.headline || null,
        article.transcriptSummary || null,
        article.url
      )
    );
    if (updateStmts.length > 0) {
      await env.DB.batch(updateStmts);
    }

    const websiteHints: Record<string, string> = {};
    for (const article of scored) {
      if (article.enrichedCompanyMentions) {
        for (const mention of article.enrichedCompanyMentions) {
          if (mention.website) {
            websiteHints[mention.name] = mention.website;
          }
        }
      }
    }

    console.log(`Scored ${scored.length} articles`);
    return {
      status: 'ok',
      metrics: {
        candidates: unscoredFromDb.length,
        scored: scored.length,
      },
      result: {
        scored: scored.length,
        candidates: unscoredFromDb.length,
        websiteHints,
        skipped: false,
        scoredUrls: scored.map((a) => a.url),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Scoring failed:', err);
    return {
      status: 'error',
      metrics: { candidates: 0, scored: 0 },
      errors: [message],
      result: {
        scored: 0,
        candidates: 0,
        websiteHints: {},
        skipped: false,
        scoredUrls: [],
        error: message,
      },
    };
  }
}
