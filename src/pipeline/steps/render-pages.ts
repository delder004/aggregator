/**
 * Pipeline step: generate every site page, hash, and KV-write the
 * delta against the prior run.
 *
 * Three phases:
 *  1. Stale-link cleanup + load all the data the renderer needs
 *     (articles, featured, tags, companies, insights, jobs).
 *  2. generateAllPages() produces a path → HTML map. Each is SHA-256'd
 *     and compared to the previous hash bundle stored in KV at
 *     __page_hashes_v2__. Pages whose hash unchanged are skipped entirely.
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

// v6: bumped 2026-06-04. Bug in v5: recovery verification loop only handled
// `r.status === 'fulfilled' && !r.value.ok` — it ignored `r.status === 'rejected'`
// entirely. When env.KV.get() throws (subrequest exhaustion, timeout, etc.) inside
// Promise.allSettled, the result is `rejected`. The old loop treated that as
// "verified OK", stored the new hash, and permanently skipped the page on all
// subsequent crons. Pages whose underlying KV.put() was a silent failure (data
// not persisted) would keep serving stale content forever.
// Fix: treat rejected verification results the same as hash-mismatch failures —
// remove from successfulPaths so the hash is NOT stored and the next cron retries.
// The v6 key forces a full re-render to clear /map and /company/* pages still
// stuck from v5's incorrect hash records.
const PAGE_HASHES_KEY = '__page_hashes_v6__';
const ONE_HUNDRED_EIGHTY_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

export interface RenderPagesResult {
  pagesWritten: number;
  totalPages: number;
  staleKeys: number;
  error?: string;
}

export interface RenderPagesContext {
  /** Tracked companies fetched once by the workflow; saves a D1 read. */
  companies?: Company[];
}

export async function renderPagesStep(
  env: Env,
  ctx?: RenderPagesContext
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

    // Coarsen the corpus counts to nearest 100 for the same reason as
    // lastUpdated below: the exact numbers shift every cron (every
    // collected article bumps crawled; every scoring promotion bumps
    // published), so they were re-hashing every stats-bearing page on
    // every cron. Rendered as "28,000+" in the footer.
    const rawPublishedCount = await getArticleCount(env.DB, MIN_PUBLISH_SCORE);
    const rawCrawledArticles = await getTotalArticleCount(env.DB);
    const publishedCount = Math.floor(rawPublishedCount / 100) * 100;
    const crawledArticles = Math.floor(rawCrawledArticles / 100) * 100;
    const latestPublished = recentArticles.reduce(
      (max, article) => (article.publishedAt > max ? article.publishedAt : max),
      ''
    );
    // Round the rendered timestamp down to the top of the hour so the
    // footer line doesn't invalidate every page hash on every cron.
    // Without this, a per-second `Updated YYYY-MM-DD HH:MM:SS UTC` string
    // appears in the layout() footer of ~170 pages and changes every
    // cron — re-hashing → re-writing → per-colo cache-purging. Hourly
    // granularity drops that churn to ~once per hour at most.
    const lastUpdatedDate = latestPublished
      ? new Date(latestPublished)
      : new Date();
    lastUpdatedDate.setUTCMnutes(0, 0, 0);
    const lastUpdated = `${lastUpdatedDate
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19)} UTC`;

    let sourceCount = 0;
    try {
      const sources = await getAllActiveSources(env.DB);
      sourceCount = sources.length;
    } catch {
      sourceCount = 0;
    }

    let companies: Company[] = ctx?.companies ?? [];
    if (!ctx?.companies) {
      try {
        companies = await getTrackedCompanies(env.DB);
      } catch {
        companies = [];
      }
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

    // Use Promise.allSettled so a failed put doesn't abort the batch and,
    // crucially, the hash store is only updated for paths whose put succeeded.
    // Paths whose put failed keep their old hash, ensuring the next cron retries
    // them rather than treating the stale KV entry as up-to-date.
    const successfulPaths = new Set<string>();
    let failedPuts = 0;
    for (let i = 0; i < changed.length; i += 25) {
      const batch = changed.slice(i, i + 25);
      const results = await Promise.allSettled(
        batch.map(([path, html]) => env.KV.put(path, html))
      );
      for (let j = 0; j < batch.length; j++) {
        const [path] = batch[j];
        if (results[j].status === 'fulfilled') {
          successfulPaths.add(path);
        } else {
          failedPuts++;
          console.error(
            `KV put failed for ${path}:`,
            (results[j] as PromiseRejectedResult).reason
          );
        }
      }
    }

    // On recovery runs (empty hash store — triggered by a PAGE_HASHES_KEY bump),
    // verify that all puts actually persisted. KV.put() can "silently fail":
    // the promise resolves but the write doesn't persist. Without this check,
    // the hash store records the new hash and permanently skips the stale page.
    // Verification: read back each written page and compare its SHA-256 to the
    // expected hash. Mismatches are removed from successfulPaths so the OLD hash
    // is preserved in the store — the next cron will retry those pages.
    const isRecoveryRun = Object.keys(oldHashes).length === 0;
    if (isRecoveryRun && successfulPaths.size > 0) {
      let silentFails = 0;
      const pathsToVerify = [...successfulPaths];
      for (let i = 0; i < pathsToVerify.length; i += 10) {
        const verifyBatch = pathsToVerify.slice(i, i + 10);
        const verifyResults = await Promise.allSettled(
          verifyBatch.map(async (path) => {
            const content = await env.KV.get(path, 'text');
            if (!content) return { path, ok: false };
            const buf = await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(content)
            );
            const hash = [...new Uint8Array(buf)]
              .map((b) => b.toString(16).padStart(2, '0'))
              .join('');
            return { path, ok: hash === newHashes[path] };
          })
        );
        for (let j = 0; j < verifyResults.length; j++) {
          const r = verifyResults[j];
          if (r.status === 'rejected') {
            // KV.get() threw (e.g. subrequest limit, timeout). Treat as
            // unverified — do NOT record the new hash so the next cron retries.
            successfulPaths.delete(verifyBatch[j]);
            silentFails++;
          } else if (!r.value.ok) {
            successfulPaths.delete(r.value.path);
            silentFails++;
          }
        }
      }
      if (silentFails > 0) {
        console.warn(
          `[render-pages] ${silentFails}/${pathsToVerify.length} silent KV write` +
            ` failures on recovery run; affected pages will retry next cron.`
        );
      } else {
        console.log(
          `[render-pages] Recovery verification: all ${pathsToVerify.length}` +
            ` pages confirmed written to KV.`
        );
      }
    }

    const staleKeys = Object.keys(oldHashes).filter(
      (key) => !(key in newHashes)
    );
    for (let i = 0; i < staleKeys.length; i += 25) {
      const batch = staleKeys.slice(i, i + 25);
      await Promise.all(batch.map((key) => env.KV.delete(key)));
    }

    // Build the hash store: record new hashes only for pages whose put
    // succeeded. Failed puts preserve the old hash so the next cron retries.
    // Unchanged pages (not in changed) carry their new hash (same value anyway).
    // Stale pages (in oldHashes but absent from newHashes) are excluded.
    const changedPathSet = new Set(changed.map(([p]) => p));
    const hashStoreToSave: Record<string, string> = {};
    for (const [path, hash] of Object.entries(newHashes)) {
      if (!changedPathSet.has(path)) {
        hashStoreToSave[path] = hash; // unchanged
      } else if (successfulPaths.has(path)) {
        hashStoreToSave[path] = hash; // changed + written
      } else if (oldHashes[path]) {
        hashStoreToSave[path] = oldHashes[path]; // changed but put failed — retry next cron
      }
      // New page whose put failed: omit so next cron includes it in changed.
    }
    await env.KV.put(PAGE_HASHES_KEY, JSON.stringify(hashStoreToSave));

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
      `KV: ${changed.length}/${entries.length} pages changed, wrote ${successfulPaths.size}` +
        (failedPuts > 0 ? ` (${failedPuts} puts failed — will retry next cron)` : '') +
        `, deleted ${staleKeys.length} stale keys, purged ${purgePaths.length} edge-cache entries` +
        ` (${entries.length - changed.length} skipped unchanged)`
    );

    return {
      status: 'ok',
      metrics: {
        pagesWritten: successfulPaths.size,
        totalPages: entries.length,
        staleKeys: staleKeys.length,
      },
      result: {
        pagesWritten: successfulPaths.size,
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
