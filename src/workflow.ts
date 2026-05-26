import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type {
  Env,
  Article,
  CollectedArticle,
  Collector,
  SourceConfig,
  ScoredArticle,
  Company,
  CompanyInsight,
  CompanyJob,
  SourceType,
  RunStepReport,
  RunWorkflowParams,
} from './types';
import { rssCollector } from './collectors/rss';
import { hackerNewsCollector } from './collectors/hackernews';
import { createYouTubeCollector } from './collectors/youtube';
import { arxivCollector } from './collectors/arxiv';
import { substackCollector } from './collectors/substack';
import { productHuntCollector } from './collectors/producthunt';
import { ycombinatorCollector } from './collectors/ycombinator';
import { companyBlogCollector } from './collectors/companyblog';
import { pressReleaseCollector } from './collectors/pressrelease';
import { blogScraperCollector } from './collectors/blogscraper';
import { scoreArticles, MIN_PUBLISH_SCORE } from './scoring/classifier';
import { getTrackedCompanies, matchArticleToCompanies, linkArticleToCompanies, updateCompanyStats, discoverNewCompanies, createDiscoveredCompany, insertSource } from './company/tracker';
import { probeWebsite, discoverBlog, probeJobBoards, MAX_ENRICHMENTS_PER_RUN } from './company/enricher';
import { CURATED_DESCRIPTIONS } from './company/descriptions';
import { generateCompanyInsights } from './insights/company-insights';
import {
  getPublishedArticles,
  getFeaturedArticles,
  getAllActiveSources,
  getAllUniqueTags,
  getUnscoredArticles,
  getAllCompanyArticles,
  getAllCompanyInsights,
  getTotalArticleCount,
  getLatestSummaries,
  getArticleCount,
  cleanupStaleArticleCompanyLinks,
  syncCuratedCompanyDescriptions,
} from './db/queries';
import { collectAllJobs, shouldFetchJobs, markJobsFetched, getAllCompanyJobs } from './collectors/jobs';
import { generateAllPages } from './renderer/pages';
import { generateRssFeed } from './renderer/rss';
import { generateWeeklyNewsletter } from './renderer/newsletter';
import { createNewsletterDraft } from './newsletter/buttondown';
import {
  deriveWorkflowStatus,
  finishTrackedWorkflow,
  maybeFinalizePipelineRun,
  recordTrackedStep,
  startTrackedWorkflow,
} from './runs/service';
import { runStep } from './pipeline/step-runner';
import { loadSourcesStep } from './pipeline/steps/load-sources';
import {
  runCollectBatch,
  type CollectBatchResult,
} from './pipeline/steps/collect-batch';
import { storeArticlesStep } from './pipeline/steps/store-articles';
import { scoreArticlesStep } from './pipeline/steps/score-articles';
import { companyTrackingStep } from './pipeline/steps/company-tracking';
import { companyEnrichmentStep } from './pipeline/steps/company-enrichment';

const MAX_SCORE_PER_RUN = 200;
const SOURCES_PER_BATCH = 10;

function generateId(): string {
  return crypto.randomUUID();
}

function nowIso(): string {
  return new Date().toISOString();
}

async function safeTrack(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[RunTracker] ${label} failed:`, err);
  }
}

async function recordStep(
  env: Env,
  pipelineRunId: string,
  workflowName: 'collect' | 'process',
  reports: RunStepReport[],
  report: RunStepReport
): Promise<void> {
  reports.push(report);
  await safeTrack(`${workflowName}/${report.stepName}`, async () => {
    await recordTrackedStep(env, pipelineRunId, workflowName, report);
  });
}

function getRunParams(
  event: Readonly<WorkflowEvent<RunWorkflowParams>>,
  workflowStartedAt: string
): RunWorkflowParams {
  const payload = event.payload as Partial<RunWorkflowParams> | undefined;
  if (
    payload?.pipelineRunId &&
    payload.triggerType &&
    payload.triggerSource &&
    payload.startedAt
  ) {
    return payload as RunWorkflowParams;
  }

  return {
    pipelineRunId: event.instanceId,
    triggerType: 'scheduled',
    triggerSource: 'workflow',
    startedAt: workflowStartedAt,
  };
}

/**
 * CollectWorkflow — collects articles from sources and stores them in D1.
 * Does NOT score, generate insights, or render pages.
 */
export class CollectWorkflow extends WorkflowEntrypoint<Env, RunWorkflowParams> {
  async run(
    event: Readonly<WorkflowEvent<RunWorkflowParams>>,
    step: WorkflowStep
  ) {
    const startTime = Date.now();
    const workflowStartedAt = nowIso();
    const params = getRunParams(event, workflowStartedAt);
    const stepReports: RunStepReport[] = [];
    console.log(
      `Collect workflow started for pipeline run ${params.pipelineRunId}`
    );

    await safeTrack('collect/start', async () => {
      await startTrackedWorkflow(
        this.env,
        params,
        'collect',
        event.instanceId,
        workflowStartedAt
      );
    });

    try {
      const sources =
        (await runStep(this.env, step, params, 'collect', stepReports, {
          name: 'load-sources',
          retries: { limit: 2, delay: '5 seconds' },
          fn: () => loadSourcesStep(this.env),
        })) ?? [];

      const batchResults: CollectBatchResult[] = [];
      const batchCount = Math.ceil(sources.length / SOURCES_PER_BATCH);
      for (let b = 0; b < batchCount; b++) {
        const start = b * SOURCES_PER_BATCH;
        const batchSources = sources.slice(start, start + SOURCES_PER_BATCH);
        const result = await runStep(
          this.env,
          step,
          params,
          'collect',
          stepReports,
          {
            name: `collect-batch-${b}`,
            retries: { limit: 1, delay: '5 seconds' },
            fn: () => runCollectBatch(this.env, batchSources, b),
          }
        );
        if (result) batchResults.push(result);
      }

      const allCollected = batchResults.flatMap((r) => r.articles);
      const allSourceUpdates = batchResults.flatMap((r) => r.sourceUpdates);
      console.log(
        `Total collected: ${allCollected.length} articles from ${sources.length} sources`
      );

      const storeResult = await runStep(
        this.env,
        step,
        params,
        'collect',
        stepReports,
        {
          name: 'store-articles',
          retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
          fn: () =>
            storeArticlesStep(
              this.env,
              allCollected,
              allSourceUpdates,
              sources.length
            ),
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(
        `Collect workflow completed in ${elapsed}ms. ` +
          `Collected: ${storeResult?.collected ?? 0}, ` +
          `New: ${storeResult?.fresh ?? 0}, ` +
          `Inserted: ${storeResult?.inserted ?? 0}, ` +
          `Sources: ${storeResult?.sourceCount ?? 0}`
      );

      await safeTrack('collect/finish', async () => {
        await finishTrackedWorkflow(
          this.env,
          params.pipelineRunId,
          'collect',
          deriveWorkflowStatus(stepReports),
          nowIso()
        );
      });

      if (this.env.HEALTHCHECK_URL) {
        try {
          await fetch(this.env.HEALTHCHECK_URL);
        } catch (err) {
          console.error('Health check ping failed:', err);
        }
      }
    } catch (err) {
      await recordStep(this.env, params.pipelineRunId, 'collect', stepReports, {
        stepName: 'workflow-fatal',
        status: 'error',
        startedAt: workflowStartedAt,
        completedAt: nowIso(),
        errors: [err instanceof Error ? err.message : String(err)],
      });
      await safeTrack('collect/fatal-finish', async () => {
        await finishTrackedWorkflow(
          this.env,
          params.pipelineRunId,
          'collect',
          'error',
          nowIso()
        );
      });
      throw err;
    } finally {
      await safeTrack('collect/finalize-run', async () => {
        await maybeFinalizePipelineRun(this.env, params.pipelineRunId);
      });
    }
  }
}

/**
 * ProcessWorkflow — scores unscored articles, tracks companies,
 * generates insights, and renders pages to KV.
 */
export class ProcessWorkflow extends WorkflowEntrypoint<Env, RunWorkflowParams> {
  async run(event: Readonly<WorkflowEvent<RunWorkflowParams>>, step: WorkflowStep) {
    const startTime = Date.now();
    const workflowStartedAt = nowIso();
    const params = getRunParams(event, workflowStartedAt);
    const startTimeISO = new Date(startTime).toISOString();
    const stepReports: RunStepReport[] = [];
    console.log(`Process workflow started for pipeline run ${params.pipelineRunId}`);

    await safeTrack('process/start', async () => {
      await startTrackedWorkflow(this.env, params, 'process', event.instanceId, workflowStartedAt);
    });

    try {
      const scoring = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'score-articles',
          retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
          fn: () => scoreArticlesStep(this.env, MAX_SCORE_PER_RUN),
        }
      );

      const companyTracking = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'company-tracking',
          retries: { limit: 1, delay: '5 seconds' },
          fn: () => companyTrackingStep(this.env, startTimeISO),
        }
      );

      const enrichment = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'company-enrichment',
          retries: { limit: 1, delay: '5 seconds' },
          fn: () =>
            companyEnrichmentStep(
              this.env,
              startTimeISO,
              scoring?.websiteHints ?? {}
            ),
        }
      );

      const jobsStartedAt = nowIso();
      const jobCollection = await step.do(
        'collect-jobs',
        {
          retries: { limit: 1, delay: '5 seconds' },
        },
        async () => {
          try {
            const shouldFetch = await shouldFetchJobs(this.env.KV);
            if (!shouldFetch) {
              console.log('Jobs: skipping, last fetch was < 23 hours ago');
              return { fetched: 0, companies: 0, skipped: true, reason: 'Job fetch is on cooldown.' };
            }

            const companies = await getTrackedCompanies(this.env.DB);
            const result = await collectAllJobs(this.env.DB, companies);
            await markJobsFetched(this.env.KV);
            return { ...result, skipped: false };
          } catch (err) {
            console.error('Job collection failed:', err);
            return {
              fetched: 0,
              companies: 0,
              skipped: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'collect-jobs',
        status: jobCollection.error ? 'error' : jobCollection.skipped ? 'skipped' : 'ok',
        startedAt: jobsStartedAt,
        completedAt: nowIso(),
        metrics: {
          fetched: jobCollection.fetched,
          companies: jobCollection.companies,
        },
        notes: jobCollection.skipped ? [jobCollection.reason ?? 'Job collection skipped.'] : [],
        errors: jobCollection.error ? [jobCollection.error] : [],
      });

      // Sync curated company descriptions before rendering pages
      const syncStartedAt = nowIso();
      const sync = await step.do(
        'sync-descriptions',
        {
          retries: { limit: 1, delay: '5 seconds' },
        },
        async () => {
          try {
            const updated = await syncCuratedCompanyDescriptions(this.env.DB, CURATED_DESCRIPTIONS);
            console.log(`Synced ${updated} company descriptions`);
            return { updated };
          } catch (err) {
            console.error('Description sync failed:', err);
            return {
              updated: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'sync-descriptions',
        status: sync.error ? 'error' : 'ok',
        startedAt: syncStartedAt,
        completedAt: nowIso(),
        metrics: { updated: sync.updated },
        errors: sync.error ? [sync.error] : [],
      });

      const renderStartedAt = nowIso();
      const rendering = await step.do(
        'render-pages',
        {
          retries: { limit: 2, delay: '5 seconds', backoff: 'linear' },
        },
        async () => {
          try {
            // Clean up stale article-company links before rendering
            const deletedLinks = await cleanupStaleArticleCompanyLinks(this.env.DB);
            if (deletedLinks > 0) {
              console.log(`Cleaned up ${deletedLinks} stale article-company links`);
            }

            const oneEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
            const publishedArticles = await getPublishedArticles(this.env.DB, {
              limit: 1000,
              minScore: MIN_PUBLISH_SCORE,
            });
            const recentArticles = publishedArticles.filter((article) => article.publishedAt >= oneEightyDaysAgo);
            const featuredArticles = await getFeaturedArticles(this.env.DB, 10);
            const tags = await getAllUniqueTags(this.env.DB);

            const publishedCount = await getArticleCount(this.env.DB, MIN_PUBLISH_SCORE);
            const crawledArticles = await getTotalArticleCount(this.env.DB);
            const latestPublished = recentArticles.reduce(
              (max, article) => (article.publishedAt > max ? article.publishedAt : max),
              ''
            );
            const lastUpdated = latestPublished
              ? `${new Date(latestPublished).toISOString().replace('T', ' ').slice(0, 19)} UTC`
              : `${nowIso().replace('T', ' ').slice(0, 19)} UTC`;

            let sourceCount = 0;
            try {
              const sources = await getAllActiveSources(this.env.DB);
              sourceCount = sources.length;
            } catch {
              sourceCount = 0;
            }

            let companies: Company[] = [];
            try {
              companies = await getTrackedCompanies(this.env.DB);
            } catch {
              companies = [];
            }

            let companyArticles = new Map<string, Article[]>();
            try {
              companyArticles = await getAllCompanyArticles(this.env.DB);
            } catch (err) {
              console.error('Failed to fetch company articles:', err);
            }

            // Generate fresh company insights (capped at 10 per run)
            try {
              await generateCompanyInsights(this.env);
            } catch (err) {
              console.error('Failed to generate company insights:', err);
            }

            let companyInsights = new Map<string, CompanyInsight>();
            try {
              companyInsights = await getAllCompanyInsights(this.env.DB);
            } catch (err) {
              console.error('Failed to fetch company insights:', err);
            }

            let companyJobs = new Map<string, CompanyJob[]>();
            try {
              companyJobs = await getAllCompanyJobs(this.env.DB);
            } catch (err) {
              console.error('Failed to fetch company jobs:', err);
            }

            let insights = undefined;
            try {
              insights = await getLatestSummaries(this.env.DB);
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

            const hashKey = '__page_hashes__';
            const oldHashesRaw = await this.env.KV.get(hashKey, 'text');
            const oldHashes: Record<string, string> = oldHashesRaw ? JSON.parse(oldHashesRaw) : {};

            const entries = Object.entries(pages);
            const newHashes: Record<string, string> = {};
            const changed: [string, string][] = [];

            for (const [path, html] of entries) {
              const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(html));
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
              await Promise.all(batch.map(([path, html]) => this.env.KV.put(path, html)));
            }

            const staleKeys = Object.keys(oldHashes).filter((key) => !(key in newHashes));
            for (let i = 0; i < staleKeys.length; i += 25) {
              const batch = staleKeys.slice(i, i + 25);
              await Promise.all(batch.map((key) => this.env.KV.delete(key)));
            }

            await this.env.KV.put(hashKey, JSON.stringify(newHashes));

            // Purge edge cache for changed/removed paths so manual testing
            // doesn't wait out the s-maxage=3600 set by the fetch handler.
            // Note: caches.default.delete() is per-colo — this only purges
            // the colo running the cron, not the global edge. Good enough
            // for dev iteration; for a true global purge use the CF API.
            const purgePaths = [...changed.map(([path]) => path), ...staleKeys].filter((p) =>
              p.startsWith('/')
            );
            const hostname = this.env.SITE_HOSTNAME ?? 'agenticaiccounting.com';
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
              pagesWritten: changed.length,
              totalPages: entries.length,
              staleKeys: staleKeys.length,
            };
          } catch (err) {
            console.error('Page generation failed:', err);
            return {
              pagesWritten: 0,
              totalPages: 0,
              staleKeys: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'render-pages',
        status: rendering.error ? 'error' : 'ok',
        startedAt: renderStartedAt,
        completedAt: nowIso(),
        metrics: {
          pagesWritten: rendering.pagesWritten,
          totalPages: rendering.totalPages,
          staleKeys: rendering.staleKeys,
        },
        errors: rendering.error ? [rendering.error] : [],
      });

      const newsletterStartedAt = nowIso();
      const newsletter = await step.do(
        'newsletter-draft',
        {
          retries: { limit: 1, delay: '5 seconds' },
        },
        async () => {
          try {
            if (!this.env.BUTTONDOWN_API_KEY) {
              return { skipped: true, reason: 'no API key' };
            }

            const now = new Date();
            if (now.getUTCDay() !== 1) {
              return { skipped: true, reason: 'not Monday' };
            }

            const lastDraft = await this.env.KV.get('newsletter:last_draft');
            if (lastDraft) {
              const elapsed = now.getTime() - new Date(lastDraft).getTime();
              if (elapsed < 6 * 24 * 60 * 60 * 1000) {
                return { skipped: true, reason: 'already sent this week' };
              }
            }

            const articles = await getPublishedArticles(this.env.DB, {
              limit: 50,
              minScore: MIN_PUBLISH_SCORE,
            });
            const { subject, body } = generateWeeklyNewsletter(articles);

            const ok = await createNewsletterDraft(this.env.BUTTONDOWN_API_KEY, subject, body);
            if (ok) {
              await this.env.KV.put('newsletter:last_draft', now.toISOString());
            }

            return { skipped: false, created: ok };
          } catch (err) {
            console.error('Newsletter draft failed:', err);
            return {
              skipped: false,
              created: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'newsletter-draft',
        status: newsletter.error
          ? 'error'
          : newsletter.skipped
            ? 'skipped'
            : newsletter.created
              ? 'ok'
              : 'warning',
        startedAt: newsletterStartedAt,
        completedAt: nowIso(),
        metrics: {
          created: newsletter.created ?? false,
        },
        notes: newsletter.skipped ? [`Skipped: ${newsletter.reason}`] : [],
        errors: newsletter.error ? [newsletter.error] : newsletter.created === false && !newsletter.skipped ? ['Newsletter draft creation returned false.'] : [],
      });

      const elapsed = Date.now() - startTime;
      console.log(
        `Process workflow completed in ${elapsed}ms. ` +
          `Scored: ${scoring?.scored ?? 0}, ` +
          `Companies matched: ${companyTracking?.matched ?? 0}, ` +
          `Enrichment: ${enrichment?.discovered ?? 0} discovered / ${enrichment?.enriched ?? 0} enriched, ` +
          `Jobs: ${jobCollection.fetched} from ${jobCollection.companies} companies${jobCollection.skipped ? ' (skipped)' : ''}, ` +
          `Pages: ${rendering.pagesWritten}, ` +
          `Newsletter: ${newsletter.skipped ? 'skipped (' + (newsletter as { reason?: string }).reason + ')' : newsletter.created ? 'draft created' : 'failed'}`
      );

      await safeTrack('process/finish', async () => {
        await finishTrackedWorkflow(
          this.env,
          params.pipelineRunId,
          'process',
          deriveWorkflowStatus(stepReports),
          nowIso()
        );
      });

      if (this.env.HEALTHCHECK_URL) {
        try {
          await fetch(this.env.HEALTHCHECK_URL);
        } catch (err) {
          console.error('Health check ping failed:', err);
        }
      }
    } catch (err) {
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'workflow-fatal',
        status: 'error',
        startedAt: workflowStartedAt,
        completedAt: nowIso(),
        errors: [err instanceof Error ? err.message : String(err)],
      });
      await safeTrack('process/fatal-finish', async () => {
        await finishTrackedWorkflow(this.env, params.pipelineRunId, 'process', 'error', nowIso());
      });
      throw err;
    } finally {
      await safeTrack('process/finalize-run', async () => {
        await maybeFinalizePipelineRun(this.env, params.pipelineRunId);
      });
    }
  }
}
