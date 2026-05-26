import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type {
  Company,
  Env,
  RunStepReport,
  RunWorkflowParams,
  ScoredArticle,
} from './types';
import { getRecentlyScoredArticles } from './db/queries';
import { getTrackedCompanies } from './company/tracker';
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
import {
  collectJobsStep,
  shouldRunCollectJobs,
} from './pipeline/steps/collect-jobs';
import { syncDescriptionsStep } from './pipeline/steps/sync-descriptions';
import { renderPagesStep } from './pipeline/steps/render-pages';
import {
  newsletterDraftStep,
  shouldRunNewsletter,
} from './pipeline/steps/newsletter-draft';

const MAX_SCORE_PER_RUN = 200;
const SOURCES_PER_BATCH = 10;

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

      // Fetch shared D1 state ONCE after scoring (so newly-scored articles
      // are visible to tracking). Threaded into the four downstream steps
      // that would otherwise each issue their own getTrackedCompanies /
      // getRecentlyScoredArticles. Cuts ~5 D1 round-trips per cron.
      //
      // companies may grow during enrichment; refetched downstream only
      // when enrichment.newCompanyIds is non-empty.
      let companies: Company[] = [];
      try {
        companies = await getTrackedCompanies(this.env.DB);
      } catch (err) {
        console.error('process/load-companies failed:', err);
      }
      let recentlyScored: ScoredArticle[] = [];
      try {
        recentlyScored = await getRecentlyScoredArticles(
          this.env.DB,
          startTimeISO
        );
      } catch (err) {
        console.error('process/load-recently-scored failed:', err);
      }

      const companyTracking = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'company-tracking',
          retries: { limit: 1, delay: '5 seconds' },
          fn: () =>
            companyTrackingStep(this.env, startTimeISO, {
              companies,
              recentlyScored,
            }),
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
              scoring?.websiteHints ?? {},
              { companies, recentlyScored }
            ),
        }
      );

      // Refetch companies only if enrichment created new ones — they need
      // to be visible to jobs + render. Common case (zero new companies)
      // reuses the snapshot from before tracking.
      if ((enrichment?.newCompanyIds.length ?? 0) > 0) {
        try {
          companies = await getTrackedCompanies(this.env.DB);
        } catch (err) {
          console.error('process/refresh-companies failed:', err);
        }
      }

      const jobCollection = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'collect-jobs',
          retries: { limit: 1, delay: '5 seconds' },
          shouldRun: () => shouldRunCollectJobs(this.env),
          skipReason: 'Job fetch is on cooldown.',
          fn: () => collectJobsStep(this.env, { companies }),
        }
      );

      await runStep(this.env, step, params, 'process', stepReports, {
        name: 'sync-descriptions',
        retries: { limit: 1, delay: '5 seconds' },
        fn: () => syncDescriptionsStep(this.env),
      });

      // Quiet-run gate: skip the ~12s render step entirely when nothing
      // upstream produced new data. Pages get stale by 1-2 hours when the
      // pipeline is idle; acceptable for an hourly aggregator. Cleanup of
      // stale article-company links rides inside render-pages and catches
      // up the next time something does change.
      const upstreamActivity =
        (scoring?.scored ?? 0) +
        (companyTracking?.matched ?? 0) +
        (enrichment?.discovered ?? 0);
      const rendering = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'render-pages',
          retries: { limit: 2, delay: '5 seconds', backoff: 'linear' },
          shouldRun: () => upstreamActivity > 0,
          skipReason:
            'No scoring/tracking/enrichment activity this run — pages unchanged.',
          fn: () => renderPagesStep(this.env, { companies }),
        }
      );

      const newsletter = await runStep(
        this.env,
        step,
        params,
        'process',
        stepReports,
        {
          name: 'newsletter-draft',
          retries: { limit: 1, delay: '5 seconds' },
          shouldRun: () => shouldRunNewsletter(this.env),
          skipReason:
            'Newsletter preconditions unmet (not Monday, no API key, or sent this week).',
          fn: () => newsletterDraftStep(this.env),
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(
        `Process workflow completed in ${elapsed}ms. ` +
          `Scored: ${scoring?.scored ?? 0}, ` +
          `Companies matched: ${companyTracking?.matched ?? 0}, ` +
          `Enrichment: ${enrichment?.discovered ?? 0} discovered / ${enrichment?.enriched ?? 0} enriched, ` +
          `Jobs: ${jobCollection?.fetched ?? 0} from ${jobCollection?.companies ?? 0} companies${jobCollection === undefined ? ' (cooldown)' : ''}, ` +
          `Pages: ${rendering?.pagesWritten ?? 0}, ` +
          `Newsletter: ${newsletter === undefined ? 'skipped' : newsletter.created ? 'draft created' : 'failed'}`
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
