/**
 * Pipeline step: generate every site page, hash, and KV-write the
 * delta against the prior run.
 *
 * Three phases:
 *  1. Stale-link cleanup + load all the data the renderer needs
 *     (articles, featured, tags, companies, insights, jobs).
 *  2. generateAllPages() produces a path → HTML map. Each is SHA-256'd
 *     and compared to the previous hash bundle stored in KV at
 *     __page_hashes__. Pages whose hash unchanged are skipped entirely.
 *  3. Written pages have their edge-cache entries purged so manual
 *     verification doesn't wait out the s-maxage=3600 on the fetch handler.
 *     Per-colo only (the cron only runs in one colo).
 */

import type {
  Article,
  Company,
  CompanyInsight,
  CompanyJob,
  Env,
} from '../../types';
import {
  cleanupStaleArticleCompanyLinks,
  getAllCompanyArticles,
  getAllCompanyInsights,
  getAllUniqueTags,
  getArticleCount,
  getFeaturedArticles,
  getLatestSummaries,
  getPublishedArticles,
  getTotalArticleCount,
  getAllActiveSources,
} from '../../db/queries';
import { getTrackedCompanies } from '../../company/tracker';
import { getAllCompanyJobs } from '../../collectors/jobs';
import { generateCompanyInsights } from '../../insights/company-insights';
import { generateAllPages } from '../../renderer/pages';
import { generateRssFeed } from '../../renderer/rss';
import { MIN_PUBLISH_SCORE } from '../../scoring/classifier';
import type { StepOutcome } from '../step-runner';

const PAGE_HASHES_KEY = '__page_hashes__';
const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

export interface RenderPagesResult {
  pagesWritten: number;
  totalPages: number;
  staleKeys: number;
  error?: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function renderPagesStep(
  env: Env
): Promise<StepOutcome<RenderPagesResult>> {
  try {
    const deletedLinks = await cleanupStaleArticleCompanyLinks(env.DB);
    if (deletedLinks > 0) {
      console.log(
        `Cleaned up ${deletedLinks} stale article-company links`
      );
    }

    const oneEightyDaysAgo = new Date(
      Date.now() - ONE_HUNDRED_EIGHTY_DAYS_MS
    ).toISOString();
    const publishedArticles = await getPublishedArticles(env.DB, {
      limit: 1000,
      minScore: MIN_PUBLISH_SCORE,
    });
    const recentArticles = publishedArticles.filter(
      (article) => article.publishedAt >= oneEightyDaysAgo
    );
    const featuredArticles = await getFeaturedArticles(env.DB, 10);
    const tags = await getAllUniqueTags(env.DB);

    const publishedCount = await getArticleCount(env.DB, MIN_PUBLISH_SCORE);
    const crawledArticles = await getTotalArticleCount(env.DB);
    const latestPublished = recentArticles.reduce(
      (max, article) => (article.publishedAt > max ? article.publishedAt : max),
      ''
    );
    const lastUpdated = latestPublished
      ? `${new Date(latestPublished).toISOString().replace('T', ' ').slice(0, 19)} UTC`
      : `${nowIso().replace('T', ' ').slice(0, 19)} UTC`;

    let sourceCount = 0;
    try {
      const sources = await getAllActiveSources(env.DB);
      sourceCount = sources.length;
    } catch {
      sourceCount = 0;
    }

    let companies: Company[] = [];
    try {
      companies = await getTrackedCompanies(env.DB);
    } catch {
      companies = [];
    }

    let companyArticles = new Map<string, Article[]>();
    try {
      companyArticles = await getAllCompanyArticles(env.DB);
    } catch (err) {
      console.error('Failed to fetch company articles:', err);
    }

    try {
      await generateCompanyInsights(env);
    } catch (err) {
      console.error('Failed to generate company insights:', err);
    }

    let companyInsights = new Map<string, CompanyInsight>();
    try {
      companyInsights = await getAllCompanyInsights(env.DB);
    } catch (err) {
      console.error('Failed to fetch company insights:', err);
    }

    let companyJobs = new Map<string, CompanyJob[]>();
    try {
      companyJobs = await getAllCompanyJobs(env.DB);
    } catch (err) {
      console.error('Failed to fetch company jobs:', err);
    }

    let insights = undefined;
    try {
      insights = await getLatestSummaries(env.DB);
    } catch (err) {
      console.error('Failed to fetch insights:', err);
    }

    const pages = generateAllPages(
      recentArticles,
      featuredArticles,
      tags,
      {
        sources: sourceCount,
        crawled: crawledArticles,
        articles: publishedCount,
        lastUpdated,
      },
      companies,
      companyArticles,
      companyInsights,
      companyJobs,
      insights
    );

    const rssFeed = generateRssFeed(recentArticles.slice(0, 50));
    pages['/feed.xml'] = rssFeed;

    const oldHashesRaw = await env.KV.get(PAGE_HASHES_KEY, 'text');
    const oldHashes: Record<string, string> = oldHashesRaw
      ? JSON.parse(oldHashesRaw)
      : {};

    const entries = Object.entries(pages);
    const newHashes: Record<string, string> = {};
    const changed: [string, string][] = [];

    for (const [path, html] of entries) {
      const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(html)
      );
      const hash = [...new Uint8Array(buf)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      newHashes[path] = hash;
      if (oldHashes[path] !== hash) {
        changed.push([path, html]);
      }
    }

    for (let i = 0; i < changed.length; i += 25) {
      const batch = changed.slice(i, i + 25);
      await Promise.all(
        batch.map(([path, html]) => env.KV.put(path, html))
      );
    }

    const staleKeys = Object.keys(oldHashes).filter(
      (key) => !(key in newHashes)
    );
    for (let i = 0; i < staleKeys.length; i += 25) {
      const batch = staleKeys.slice(i, i + 25);
      await Promise.all(batch.map((key) => env.KV.delete(key)));
    }

    await env.KV.put(PAGE_HASHES_KEY, JSON.stringify(newHashes));

    // Per-colo edge-cache purge — global purge would need the CF API.
    const purgePaths = [
      ...changed.map(([path]) => path),
      ...staleKeys,
    ].filter((p) => p.startsWith('/'));
    const hostname = env.SITE_HOSTNAME ?? 'agenticaiccounting.com';
    for (let i = 0; i < purgePaths.length; i += 25) {
      const batch = purgePaths.slice(i, i + 25);
      await Promise.all(
        batch.map((path) =>
          caches.default
            .delete(new Request(`https://${hostname}${path}`, { method: 'GET' }))
            .catch((err) => {
              console.error(`Cache purge failed for ${path}:`, err);
              return false;
            })
        )
      );
    }

    console.log(
      `KV: ${changed.length}/${entries.length} pages changed, wrote ${changed.length + 1} keys, deleted ${staleKeys.length} stale keys, purged ${purgePaths.length} edge-cache entries (${entries.length - changed.length} skipped)`
    );

    return {
      status: 'ok',
      metrics: {
        pagesWritten: changed.length,
        totalPages: entries.length,
        staleKeys: staleKeys.length,
      },
      result: {
        pagesWritten: changed.length,
        totalPages: entries.length,
        staleKeys: staleKeys.length,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Page generation failed:', err);
    return {
      status: 'error',
      metrics: { pagesWritten: 0, totalPages: 0, staleKeys: 0 },
      errors: [message],
      result: {
        pagesWritten: 0,
        totalPages: 0,
        staleKeys: 0,
        error: message,
      },
    };
  }
}
