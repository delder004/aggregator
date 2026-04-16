import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent } from 'cloudflare:workers';
import type { Env, RunWorkflowParams } from './types';
import type { IngestNamespace } from './analytics/types';
import { getPreviousWeeklyWindow, getWeeklyWindow } from './analytics/window';
import { upsertIngestRun } from './analytics/db';
import { runCfAnalyticsSnapshot } from './analytics/cloudflare';
import { runSearchConsoleSnapshot } from './analytics/search-console';
import { runArticleViewsRollup, resolveRollupWindow } from './analytics/analytics-engine';
import { runRankingsSweep } from './analytics/rankings';
import { runCompetitorSnapshots } from './competitors/snapshot';

/**
 * IngestWorkflow — weekly capture-layer orchestrator.
 *
 * Runs all five Phase 1 capture jobs on a Monday 13:00 UTC cron schedule.
 * Each namespace runs as a separate Workflow step so failures are isolated.
 * Steps do NOT use Workflow-level retries — runNamespace() catches errors
 * and records them in ingest_runs instead of rethrowing, which means the
 * Workflow engine's retry mechanism would never fire. The individual
 * capture jobs already have their own claim/fail patterns for idempotent
 * reruns; the manual `/ops/cron/ingest` trigger is the retry path.
 * Each step writes an ingest_runs row
 * (one per namespace per window) for honest /ops/ingest/status reporting.
 *
 * Window semantics per namespace:
 *   - cf-analytics, search-console, competitors: previous complete week
 *     (getPreviousWeeklyWindow) — they aggregate data FROM that week
 *   - rankings: current week (getWeeklyWindow) — point-in-time snapshot
 *     taken DURING this week
 *   - article-views-rollup: last 7 complete UTC days (its own window
 *     logic in runArticleViewsRollup)
 *
 * The workflow does NOT participate in the pipeline_runs / pipeline_run_steps
 * telemetry from Collect/ProcessWorkflow. It writes to ingest_runs only.
 * This is intentional: the ingest workflow has a different lifecycle
 * (weekly vs hourly), different failure semantics, and a different
 * consumer (/ops/ingest/status vs /ops/runs).
 */

function nowIso(): string {
  return new Date().toISOString();
}

type IngestMetrics = Record<string, string | number | boolean | null>;

interface IngestStepResult {
  namespace: IngestNamespace;
  status: 'complete' | 'error' | 'skipped';
  metrics: IngestMetrics;
  error?: string;
}

export class IngestWorkflow extends WorkflowEntrypoint<Env, RunWorkflowParams> {
  async run(event: Readonly<WorkflowEvent<RunWorkflowParams>>, step: WorkflowStep) {
    const pipelineRunId =
      (event.payload as Partial<RunWorkflowParams> | undefined)?.pipelineRunId ??
      event.instanceId;
    const prevWeek = getPreviousWeeklyWindow();
    const currentWeek = getWeeklyWindow();

    console.log(
      `IngestWorkflow started. pipelineRunId=${pipelineRunId}, ` +
      `prevWeek=[${prevWeek.windowStart}, ${prevWeek.windowEnd}), ` +
      `currentWeek=[${currentWeek.windowStart}, ${currentWeek.windowEnd})`
    );

    const results: IngestStepResult[] = [];

    // Compute the article-views-rollup window up front so the ingest_runs
    // row records the actual window the rollup will process, not the
    // previous-week bucket (which doesn't match its date logic).
    const rollupWindow = resolveRollupWindow(new Date());

    // Every capture job receives an explicit window override so it
    // processes exactly the window that ingest_runs records. Without
    // this, each job resolves its own default from new Date(), which can
    // drift from the precomputed window if the workflow crosses a Monday
    // midnight boundary mid-run.

    // Step 1: CF GraphQL analytics (previous week)
    const cfResult = await step.do('cf-analytics', () =>
      this.runNamespace(pipelineRunId, 'cf-analytics', async () => {
        const r = await runCfAnalyticsSnapshot(this.env, {
          windowStart: prevWeek.windowStart,
          windowEnd: prevWeek.windowEnd,
        });
        return {
          written: r.written,
          reason: r.reason ?? null,
          blobKey: r.blobKey ?? null,
          totalRequests: r.data?.totals.requests ?? null,
        };
      }, prevWeek.windowStart, prevWeek.windowEnd)
    );
    results.push(cfResult);

    // Step 2: Search Console (previous week)
    const gscResult = await step.do('search-console', () =>
      this.runNamespace(pipelineRunId, 'search-console', async () => {
        const r = await runSearchConsoleSnapshot(this.env, {
          windowStart: prevWeek.windowStart,
          windowEnd: prevWeek.windowEnd,
        });
        return {
          written: r.written,
          reason: r.reason ?? null,
          blobKey: r.blobKey ?? null,
          totalImpressions: r.data?.totals.impressions ?? null,
          totalClicks: r.data?.totals.clicks ?? null,
        };
      }, prevWeek.windowStart, prevWeek.windowEnd)
    );
    results.push(gscResult);

    await step.sleep('pre-rankings-pause', '2 seconds');

    // Step 3: Rankings sweep (current week)
    const rankingsResult = await step.do('rankings', () =>
      this.runNamespace(pipelineRunId, 'rankings', async () => {
        const r = await runRankingsSweep(this.env, {
          windowStart: currentWeek.windowStart,
        });
        return {
          totalKeywords: r.totalKeywords,
          rankedCount: r.rankedCount,
          unrankedCount: r.unrankedCount,
          failedCount: r.failedCount,
        };
      }, currentWeek.windowStart, currentWeek.windowEnd)
    );
    results.push(rankingsResult);

    await step.sleep('pre-competitors-pause', '2 seconds');

    // Step 4: Competitor snapshots (previous week)
    const compResult = await step.do('competitors', () =>
      this.runNamespace(pipelineRunId, 'competitors', async () => {
        const r = await runCompetitorSnapshots(this.env, {
          windowStart: prevWeek.windowStart,
        });
        return {
          totalCompetitors: r.totalCompetitors,
          completedCount: r.completedCount,
          skippedCount: r.skippedCount,
          failedCount: r.failedCount,
        };
      }, prevWeek.windowStart, prevWeek.windowEnd)
    );
    results.push(compResult);

    await step.sleep('pre-rollup-pause', '2 seconds');

    // Step 5: Article views rollup — uses its own resolved window, NOT
    // prevWeek. The ingest_runs row records the actual fromDate..toDate
    // the rollup will process.
    const rollupWindowStartIso = rollupWindow.fromDate + 'T00:00:00.000Z';
    const rollupWindowEndIso = rollupWindow.toDate + 'T00:00:00.000Z';
    const rollupResult = await step.do('article-views-rollup', () =>
      this.runNamespace(pipelineRunId, 'article-views-rollup', async () => {
        const r = await runArticleViewsRollup(this.env, {
          fromDate: rollupWindow.fromDate,
          toDate: rollupWindow.toDate,
        });
        return {
          rowsScanned: r.rowsScanned,
          rowsWritten: r.rowsWritten,
          fromDate: r.fromDate,
          toDate: r.toDate,
        };
      }, rollupWindowStartIso, rollupWindowEndIso)
    );
    results.push(rollupResult);

    const completedCount = results.filter((r) => r.status === 'complete').length;
    const errorCount = results.filter((r) => r.status === 'error').length;
    const skippedCount = results.filter((r) => r.status === 'skipped').length;

    console.log(
      `IngestWorkflow finished. completed=${completedCount}, ` +
      `errors=${errorCount}, skipped=${skippedCount}`
    );

    return { pipelineRunId, results, completedCount, errorCount, skippedCount };
  }

  private async runNamespace(
    pipelineRunId: string,
    namespace: IngestNamespace,
    fn: () => Promise<IngestMetrics>,
    windowStart: string,
    windowEnd: string
  ): Promise<IngestStepResult> {
    const id = crypto.randomUUID();
    const startedAt = nowIso();

    await upsertIngestRun(this.env.DB, {
      id,
      pipelineRunId,
      namespace,
      windowStart,
      windowEnd,
      status: 'running',
      startedAt,
      completedAt: null,
      errorMessage: null,
      metrics: {},
    });

    try {
      const metrics = await fn();
      await upsertIngestRun(this.env.DB, {
        id,
        pipelineRunId,
        namespace,
        windowStart,
        windowEnd,
        status: 'complete',
        startedAt,
        completedAt: nowIso(),
        errorMessage: null,
        metrics,
      });
      return { namespace, status: 'complete', metrics };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`IngestWorkflow namespace ${namespace} failed:`, message);

      // Determine if this is a skip (missing config) vs a real error
      const isSkip =
        message.includes('required for') ||
        message.includes('is required');

      await upsertIngestRun(this.env.DB, {
        id,
        pipelineRunId,
        namespace,
        windowStart,
        windowEnd,
        status: isSkip ? 'skipped' : 'error',
        startedAt,
        completedAt: nowIso(),
        errorMessage: message,
        metrics: {},
      });
      return {
        namespace,
        status: isSkip ? 'skipped' : 'error',
        metrics: {},
        error: message,
      };
    }
  }
}
