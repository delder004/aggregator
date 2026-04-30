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

const MAX_SCORE_PER_RUN = 50;
const SOURCES_PER_BATCH = 10;

interface CollectBatchResult {
  articles: CollectedArticle[];
  sourceUpdates: Array<{ id: string; lastFetchedAt?: string; errorCount: number }>;
  failedSources: string[];
  sourceCount: number;
}

function getCollector(
  sourceType: string,
  env: Env
): Collector | null {
  switch (sourceType) {
    case 'rss':
      return rssCollector;
    case 'hn':
      return hackerNewsCollector;
    case 'youtube':
      return createYouTubeCollector(env);
    case 'arxiv':
      return arxivCollector;
    case 'substack':
      return substackCollector;
    case 'producthunt':
      return productHuntCollector;
    case 'ycombinator':
      return ycombinatorCollector;
    case 'companyblog':
      return companyBlogCollector;
    case 'pressrelease':
      return pressReleaseCollector;
    case 'blogscraper':
      return blogScraperCollector;
    default:
      return null;
  }
}

function generateId(): string {
  return crypto.randomUUID();
}

async function getRecentlyScoredArticles(db: D1Database, since: string): Promise<ScoredArticle[]> {
  const results = await db
    .prepare('SELECT * FROM articles WHERE scored_at >= ? AND relevance_score > 0')
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
  async run(event: Readonly<WorkflowEvent<RunWorkflowParams>>, step: WorkflowStep) {
    const startTime = Date.now();
    const workflowStartedAt = nowIso();
    const params = getRunParams(event, workflowStartedAt);
    const stepReports: RunStepReport[] = [];
    console.log(`Collect workflow started for pipeline run ${params.pipelineRunId}`);

    await safeTrack('collect/start', async () => {
      await startTrackedWorkflow(this.env, params, 'collect', event.instanceId, workflowStartedAt);
    });

    try {
      const loadSourcesStartedAt = nowIso();
      const sources = await step.do(
        'load-sources',
        {
          retries: { limit: 2, delay: '5 seconds' },
        },
        async () => {
          try {
            const allSources = await getAllActiveSources(this.env.DB);
            console.log(`Loaded ${allSources.length} active sources`);
            return allSources;
          } catch (err) {
            console.error('Failed to load sources:', err);
            return [] as SourceConfig[];
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'collect', stepReports, {
        stepName: 'load-sources',
        status: sources.length > 0 ? 'ok' : 'warning',
        startedAt: loadSourcesStartedAt,
        completedAt: nowIso(),
        metrics: { sources: sources.length },
        notes: sources.length > 0 ? [] : ['No active sources were loaded.'],
      });

      const batchResults: CollectBatchResult[] = [];
      const batchCount = Math.ceil(sources.length / SOURCES_PER_BATCH);
      for (let b = 0; b < batchCount; b++) {
        if (b > 0) {
          await step.sleep(`collect-pause-${b}`, '1 second');
        }
        const start = b * SOURCES_PER_BATCH;
        const batchSources = sources.slice(start, start + SOURCES_PER_BATCH);
        const batchStartedAt = nowIso();
        const result = await step.do(
          `collect-batch-${b}`,
          {
            retries: { limit: 1, delay: '5 seconds' },
          },
          async () => {
            const sourceUpdates: Array<{ id: string; lastFetchedAt?: string; errorCount: number }> = [];
            const failedSources: string[] = [];
            const collectResults = await Promise.all(
              batchSources.map(async (source) => {
                const collector = getCollector(source.sourceType, this.env);
                if (!collector) {
                  console.warn(`No collector for source type: ${source.sourceType}`);
                  failedSources.push(source.name);
                  return [] as CollectedArticle[];
                }

                try {
                  const articles = await collector.collect(source);
                  console.log(`Collected ${articles.length} articles from ${source.name}`);
                  sourceUpdates.push({
                    id: source.id,
                    lastFetchedAt: nowIso(),
                    errorCount: 0,
                  });
                  return articles;
                } catch (err) {
                  console.error(`Collector failed for ${source.name}:`, err);
                  failedSources.push(source.name);
                  sourceUpdates.push({
                    id: source.id,
                    errorCount: source.errorCount + 1,
                  });
                  return [] as CollectedArticle[];
                }
              })
            );

            const articles = collectResults.flat();
            console.log(`Batch ${b}: collected ${articles.length} articles from ${batchSources.length} sources`);

            return {
              articles,
              sourceUpdates,
              failedSources,
              sourceCount: batchSources.length,
            } as CollectBatchResult;
          }
        );
        batchResults.push(result);
        await recordStep(this.env, params.pipelineRunId, 'collect', stepReports, {
          stepName: `collect-batch-${b}`,
          status: result.failedSources.length > 0 ? 'warning' : 'ok',
          startedAt: batchStartedAt,
          completedAt: nowIso(),
          metrics: {
            sources: result.sourceCount,
            failedSources: result.failedSources.length,
            collectedArticles: result.articles.length,
          },
          notes: result.failedSources.length > 0
            ? [`Failed sources: ${result.failedSources.join(', ')}`]
            : [],
        });
      }

      const allCollected = batchResults.flatMap((result) => result.articles);
      const allSourceUpdates = batchResults.flatMap((result) => result.sourceUpdates);
      console.log(`Total collected: ${allCollected.length} articles from ${sources.length} sources`);

      await step.sleep('pre-store-pause', '1 second');

      const storeStartedAt = nowIso();
      const storeResult = await step.do(
        'store-articles',
        {
          retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
        },
        async () => {
          let sourceUpdateFailed = false;
          let dedupFailed = false;
          let insertFailures = 0;

          if (allSourceUpdates.length > 0) {
            try {
              const stmts = allSourceUpdates.map((sourceUpdate) => {
                if (sourceUpdate.lastFetchedAt) {
                  return this.env.DB
                    .prepare('UPDATE sources SET last_fetched_at = ?, error_count = ? WHERE id = ?')
                    .bind(sourceUpdate.lastFetchedAt, sourceUpdate.errorCount, sourceUpdate.id);
                }
                return this.env.DB
                  .prepare('UPDATE sources SET error_count = ? WHERE id = ?')
                  .bind(sourceUpdate.errorCount, sourceUpdate.id);
              });
              await this.env.DB.batch(stmts);
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
              const result = await this.env.DB
                .prepare(`SELECT url FROM articles WHERE url IN (${placeholders})`)
                .bind(...batch)
                .all();
              for (const row of result.results) {
                existingUrls.add(row.url as string);
              }
            }
            newArticles = allCollected.filter((article) => !existingUrls.has(article.url));
          } catch (err) {
            dedupFailed = true;
            console.error('Dedup query failed, treating all as new:', err);
          }
          console.log(`New articles after dedup: ${newArticles.length}`);

          let insertedCount = 0;
          const fetchedAt = nowIso();
          for (let i = 0; i < newArticles.length; i += 50) {
            const batch = newArticles.slice(i, i + 50);
            const stmts = batch.map((article) => this.env.DB
              .prepare(
                `INSERT OR IGNORE INTO articles
                 (id, url, title, source_type, source_name, author, published_at, fetched_at,
                  content_snippet, image_url, relevance_score, quality_score, social_score,
                  comment_count, company_mentions, ai_summary, tags, is_published, scored_at,
                  transcript)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
              )
              .bind(
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
              ));

            try {
              await this.env.DB.batch(stmts);
              insertedCount += batch.length;
            } catch (err) {
              insertFailures += batch.length;
              console.error(`Batch insert failed at offset ${i}:`, err);
            }
          }
          console.log(`Inserted ${insertedCount} articles into D1`);

          return {
            collected: allCollected.length,
            fresh: newArticles.length,
            inserted: insertedCount,
            sourceCount: sources.length,
            sourceUpdateFailed,
            dedupFailed,
            insertFailures,
          };
        }
      );

      const storeNotes: string[] = [];
      if (storeResult.sourceUpdateFailed) {
        storeNotes.push('Failed to persist one or more source status updates.');
      }
      if (storeResult.dedupFailed) {
        storeNotes.push('Dedup query failed, so all collected articles were treated as new.');
      }
      if (storeResult.insertFailures > 0) {
        storeNotes.push(`Failed to insert ${storeResult.insertFailures} articles.`);
      }
      await recordStep(this.env, params.pipelineRunId, 'collect', stepReports, {
        stepName: 'store-articles',
        status: storeNotes.length > 0 ? 'warning' : 'ok',
        startedAt: storeStartedAt,
        completedAt: nowIso(),
        metrics: {
          collected: storeResult.collected,
          newArticles: storeResult.fresh,
          inserted: storeResult.inserted,
          sources: storeResult.sourceCount,
          insertFailures: storeResult.insertFailures,
        },
        notes: storeNotes,
      });

      const elapsed = Date.now() - startTime;
      console.log(
        `Collect workflow completed in ${elapsed}ms. ` +
        `Collected: ${storeResult.collected}, New: ${storeResult.fresh}, ` +
        `Inserted: ${storeResult.inserted}, Sources: ${storeResult.sourceCount}`
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
        await finishTrackedWorkflow(this.env, params.pipelineRunId, 'collect', 'error', nowIso());
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
      const scoringStartedAt = nowIso();
      const scoring = await step.do(
        'score-articles',
        {
          retries: { limit: 2, delay: '10 seconds', backoff: 'linear' },
        },
        async () => {
          try {
            const unscoredFromDb = await getUnscoredArticles(this.env.DB, MAX_SCORE_PER_RUN);
            if (unscoredFromDb.length === 0) {
              console.log('No unscored articles to score');
              return {
                scored: 0,
                candidates: 0,
                websiteHints: {} as Record<string, string>,
                skipped: true,
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
            const scored = await scoreArticles(scoreInput, this.env);
            const scoredAt = nowIso();
            const updateStmts = scored.map((article) =>
              this.env.DB.prepare(
                `UPDATE articles SET relevance_score = ?, ai_summary = ?, tags = ?, is_published = ?, scored_at = ?,
                 quality_score = COALESCE(?, quality_score), company_mentions = COALESCE(?, company_mentions),
                 headline = COALESCE(?, headline), transcript_summary = COALESCE(?, transcript_summary)
                 WHERE url = ?`
              ).bind(
                article.relevanceScore,
                article.aiSummary,
                JSON.stringify(article.tags),
                (article.relevanceScore >= MIN_PUBLISH_SCORE && (article.qualityScore === null || article.qualityScore >= 30)) ? 1 : 0,
                scoredAt,
                article.qualityScore ?? null,
                article.companyMentions ? JSON.stringify(article.companyMentions) : null,
                article.headline || null,
                article.transcriptSummary || null,
                article.url
              )
            );
            if (updateStmts.length > 0) {
              await this.env.DB.batch(updateStmts);
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
              scored: scored.length,
              candidates: unscoredFromDb.length,
              websiteHints,
              skipped: false,
            };
          } catch (err) {
            console.error('Scoring failed:', err);
            return {
              scored: 0,
              candidates: 0,
              websiteHints: {} as Record<string, string>,
              skipped: false,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'score-articles',
        status: scoring.error ? 'error' : scoring.skipped ? 'skipped' : 'ok',
        startedAt: scoringStartedAt,
        completedAt: nowIso(),
        metrics: {
          candidates: scoring.candidates,
          scored: scoring.scored,
        },
        notes: scoring.skipped ? ['No unscored articles were available.'] : [],
        errors: scoring.error ? [scoring.error] : [],
      });

      await step.sleep('pre-company-pause', '1 second');

      const companyTrackingStartedAt = nowIso();
      const companyTracking = await step.do(
        'company-tracking',
        {
          retries: { limit: 1, delay: '5 seconds' },
        },
        async () => {
          try {
            const companies = await getTrackedCompanies(this.env.DB);
            if (companies.length === 0) {
              console.log('No tracked companies found');
              return { matched: 0, companies: 0, recentlyScored: 0, skippedReason: 'No tracked companies found.' };
            }

            const recentlyScored = await getRecentlyScoredArticles(this.env.DB, startTimeISO);
            if (recentlyScored.length === 0) {
              console.log('No recently scored articles for company tracking');
              return {
                matched: 0,
                companies: companies.length,
                recentlyScored: 0,
                skippedReason: 'No recently scored articles were available for matching.',
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
                matched: 0,
                companies: companies.length,
                recentlyScored: recentlyScored.length,
                skippedReason: 'No scored articles matched tracked companies.',
              };
            }

            const urls = [...urlToMatches.keys()];
            const urlToId = new Map<string, string>();
            for (let i = 0; i < urls.length; i += 100) {
              const batch = urls.slice(i, i + 100);
              const placeholders = batch.map(() => '?').join(',');
              const result = await this.env.DB
                .prepare(`SELECT id, url FROM articles WHERE url IN (${placeholders})`)
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
                await linkArticleToCompanies(this.env.DB, articleId, companyIds);
                companyIds.forEach((id) => matchedCompanyIds.add(id));
              }
            }

            for (const companyId of matchedCompanyIds) {
              await updateCompanyStats(this.env.DB, companyId);
            }

            console.log(`Company tracking complete: ${urlToMatches.size} articles matched against ${companies.length} companies`);
            return {
              matched: urlToMatches.size,
              companies: companies.length,
              recentlyScored: recentlyScored.length,
            };
          } catch (err) {
            console.error('Company tracking failed:', err);
            return {
              matched: 0,
              companies: 0,
              recentlyScored: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'company-tracking',
        status: companyTracking.error ? 'error' : companyTracking.skippedReason ? 'skipped' : 'ok',
        startedAt: companyTrackingStartedAt,
        completedAt: nowIso(),
        metrics: {
          trackedCompanies: companyTracking.companies,
          recentlyScored: companyTracking.recentlyScored,
          matchedArticles: companyTracking.matched,
        },
        notes: companyTracking.skippedReason ? [companyTracking.skippedReason] : [],
        errors: companyTracking.error ? [companyTracking.error] : [],
      });

      await step.sleep('pre-enrichment-pause', '1 second');

      const enrichmentStartedAt = nowIso();
      const enrichment = await step.do(
        'company-enrichment',
        {
          retries: { limit: 1, delay: '5 seconds' },
        },
        async () => {
          try {
            const companies = await getTrackedCompanies(this.env.DB);
            const recentlyScored = await getRecentlyScoredArticles(this.env.DB, startTimeISO);

            if (recentlyScored.length === 0) {
              return {
                discovered: 0,
                enriched: 0,
                failed: 0,
                skippedReason: 'No recently scored articles were available for company discovery.',
              };
            }

            const websiteHints = scoring.websiteHints ?? {};
            const candidates = discoverNewCompanies(
              recentlyScored,
              companies,
              websiteHints,
              MAX_ENRICHMENTS_PER_RUN
            );

            if (candidates.length === 0) {
              console.log('No new companies to discover');
              return {
                discovered: 0,
                enriched: 0,
                failed: 0,
                skippedReason: 'No new company candidates were identified.',
              };
            }

            console.log(
              `[Enricher] Discovered ${candidates.length} new company candidates: ${candidates.map((candidate) => candidate.name).join(', ')}`
            );

            let enrichedCount = 0;
            const failedCandidates: string[] = [];
            for (const candidate of candidates) {
              try {
                const website = await probeWebsite(candidate.name, candidate.website);
                const companyId = await createDiscoveredCompany(this.env.DB, candidate.name, website);

                if (website) {
                  const blog = await discoverBlog(website);
                  if (blog.type === 'rss' && blog.feedUrl) {
                    await insertSource(
                      this.env.DB,
                      `auto-blog-${companyId}`,
                      'companyblog',
                      `${candidate.name} Blog`,
                      { url: blog.feedUrl, company: candidate.name }
                    );
                    console.log(`[Enricher] Auto-created RSS source for ${candidate.name}: ${blog.feedUrl}`);
                  } else if (blog.type === 'scraper' && blog.blogUrl) {
                    await insertSource(
                      this.env.DB,
                      `auto-scrape-${companyId}`,
                      'blogscraper',
                      `${candidate.name} Blog`,
                      {
                        url: blog.blogUrl,
                        articlePathPrefix: '/blog/',
                        company: candidate.name,
                      }
                    );
                    console.log(`[Enricher] Auto-created blog scraper for ${candidate.name}: ${blog.blogUrl}`);
                  }
                }

                const jobBoard = await probeJobBoards(candidate.name);
                if (jobBoard) {
                  await this.env.DB
                    .prepare('UPDATE companies SET jobs_board_type = ?, jobs_board_token = ? WHERE id = ?')
                    .bind(jobBoard.type, jobBoard.token, companyId)
                    .run();
                  console.log(`[Enricher] Found ${jobBoard.type} job board for ${candidate.name} (token: ${jobBoard.token})`);
                }

                enrichedCount++;
              } catch (err) {
                failedCandidates.push(candidate.name);
                console.error(`[Enricher] Failed to enrich ${candidate.name}:`, err);
              }
            }

            console.log(`[Enricher] Complete: ${candidates.length} discovered, ${enrichedCount} enriched`);
            return {
              discovered: candidates.length,
              enriched: enrichedCount,
              failed: failedCandidates.length,
              failedCandidates,
            };
          } catch (err) {
            console.error('Company enrichment step failed:', err);
            return {
              discovered: 0,
              enriched: 0,
              failed: 0,
              error: err instanceof Error ? err.message : String(err),
            };
          }
        }
      );
      const enrichmentNotes: string[] = [];
      if (enrichment.skippedReason) {
        enrichmentNotes.push(enrichment.skippedReason);
      }
      if (enrichment.failedCandidates && enrichment.failedCandidates.length > 0) {
        enrichmentNotes.push(`Failed candidates: ${enrichment.failedCandidates.join(', ')}`);
      }
      await recordStep(this.env, params.pipelineRunId, 'process', stepReports, {
        stepName: 'company-enrichment',
        status: enrichment.error
          ? 'error'
          : enrichment.failed > 0
            ? 'warning'
            : enrichment.skippedReason
              ? 'skipped'
              : 'ok',
        startedAt: enrichmentStartedAt,
        completedAt: nowIso(),
        metrics: {
          discovered: enrichment.discovered,
          enriched: enrichment.enriched,
          failed: enrichment.failed,
        },
        notes: enrichmentNotes,
        errors: enrichment.error ? [enrichment.error] : [],
      });

      await step.sleep('pre-jobs-pause', '1 second');

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

      await step.sleep('pre-render-pause', '1 second');

      const renderStartedAt = nowIso();
      const rendering = await step.do(
        'render-pages',
        {
          retries: { limit: 2, delay: '5 seconds', backoff: 'linear' },
        },
        async () => {
          try {
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

            console.log(
              `KV: ${changed.length}/${entries.length} pages changed, wrote ${changed.length + 1} keys, deleted ${staleKeys.length} stale keys (${entries.length - changed.length} skipped)`
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
        `Scored: ${scoring.scored}, ` +
        `Companies matched: ${companyTracking.matched}, ` +
        `Enrichment: ${enrichment.discovered} discovered / ${enrichment.enriched} enriched, ` +
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
