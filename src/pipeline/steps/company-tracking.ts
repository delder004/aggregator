/**
 * Pipeline step: match recently-scored articles against tracked companies
 * and persist the article ↔ company links.
 *
 * "Recently scored" means scored_at >= the timestamp of the workflow
 * start (the watermark threaded in from the caller), so each cron only
 * processes what scoring just touched.
 *
 * Returns touchedCompanyIds so downstream rendering can scope its work.
 */

import type { Company, Env, ScoredArticle } from '../../types';
import { getRecentlyScoredArticles } from '../../db/queries';
import {
  getTrackedCompanies,
  linkArticleToCompanies,
  matchArticleToCompanies,
  updateCompanyStats,
} from '../../company/tracker';
import type { StepOutcome } from '../step-runner';

export interface CompanyTrackingResult {
  matched: number;
  companies: number;
  recentlyScored: number;
  touchedCompanyIds: string[];
  skippedReason?: string;
  error?: string;
}

export interface CompanyTrackingContext {
  companies?: Company[];
  recentlyScored?: ScoredArticle[];
}

export async function companyTrackingStep(
  env: Env,
  watermark: string,
  ctx?: CompanyTrackingContext
): Promise<StepOutcome<CompanyTrackingResult>> {
  try {
    const companies =
      ctx?.companies ?? (await getTrackedCompanies(env.DB));
    if (companies.length === 0) {
      console.log('No tracked companies found');
      return {
        status: 'skipped',
        metrics: { trackedCompanies: 0, recentlyScored: 0, matchedArticles: 0 },
        notes: ['No tracked companies found.'],
        result: {
          matched: 0,
          companies: 0,
          recentlyScored: 0,
          touchedCompanyIds: [],
          skippedReason: 'No tracked companies found.',
        },
      };
    }

    const recentlyScored =
      ctx?.recentlyScored ??
      (await getRecentlyScoredArticles(env.DB, watermark));
    if (recentlyScored.length === 0) {
      console.log('No recently scored articles for company tracking');
      return {
        status: 'skipped',
        metrics: {
          trackedCompanies: companies.length,
          recentlyScored: 0,
          matchedArticles: 0,
        },
        notes: ['No recently scored articles were available for matching.'],
        result: {
          matched: 0,
          companies: companies.length,
          recentlyScored: 0,
          touchedCompanyIds: [],
          skippedReason: 'No recently scored articles were available for matching.',
        },
      };
    }

    const urlToMatches = new Map<string, string[]>();
    for (const article of recentlyScored) {
      const matched = matchArticleToCompanies(article, companies);
      if (matched.length > 0) {
        urlToMatches.set(article.url, matched);
      }
    }

    if (urlToMatches.size === 0) {
      console.log('No company matches found');
      return {
        status: 'skipped',
        metrics: {
          trackedCompanies: companies.length,
          recentlyScored: recentlyScored.length,
          matchedArticles: 0,
        },
        notes: ['No scored articles matched tracked companies.'],
        result: {
          matched: 0,
          companies: companies.length,
          recentlyScored: recentlyScored.length,
          touchedCompanyIds: [],
          skippedReason: 'No scored articles matched tracked companies.',
        },
      };
    }

    const urls = [...urlToMatches.keys()];
    const urlToId = new Map<string, string>();
    for (let i = 0; i < urls.length; i += 100) {
      const batch = urls.slice(i, i + 100);
      const placeholders = batch.map(() => '?').join(',');
      const result = await env.DB.prepare(
        `SELECT id, url FROM articles WHERE url IN (${placeholders})`
      )
        .bind(...batch)
        .all();
      for (const row of result.results) {
        urlToId.set(row.url as string, row.id as string);
      }
    }

    const matchedCompanyIds = new Set<string>();
    for (const [url, companyIds] of urlToMatches) {
      const articleId = urlToId.get(url);
      if (articleId) {
        await linkArticleToCompanies(env.DB, articleId, companyIds);
        companyIds.forEach((id) => matchedCompanyIds.add(id));
      }
    }

    for (const companyId of matchedCompanyIds) {
      await updateCompanyStats(env.DB, companyId);
    }

    console.log(
      `Company tracking complete: ${urlToMatches.size} articles matched against ${companies.length} companies`
    );
    return {
      status: 'ok',
      metrics: {
        trackedCompanies: companies.length,
        recentlyScored: recentlyScored.length,
        matchedArticles: urlToMatches.size,
      },
      result: {
        matched: urlToMatches.size,
        companies: companies.length,
        recentlyScored: recentlyScored.length,
        touchedCompanyIds: [...matchedCompanyIds],
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Company tracking failed:', err);
    return {
      status: 'error',
      metrics: { trackedCompanies: 0, recentlyScored: 0, matchedArticles: 0 },
      errors: [message],
      result: {
        matched: 0,
        companies: 0,
        recentlyScored: 0,
        touchedCompanyIds: [],
        error: message,
      },
    };
  }
}
