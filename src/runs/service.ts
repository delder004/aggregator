import {
  claimPipelineRunRetrospective,
  failPipelineRunRetrospective,
  finishPipelineWorkflow,
  getPipelineRunById,
  getPipelineRunSteps,
  markPipelineWorkflowStarted,
  recordPipelineRunStep,
  savePipelineRunRetrospective,
  updatePipelineRunStatus,
} from '../db/queries';
import { generateRunRetrospective } from './retrospective';
import type {
  Env,
  PipelineRunStep,
  PipelineRun,
  RunStatus,
  RunStepReport,
  RunWorkflowName,
  RunWorkflowParams,
  RunWorkflowStatus,
} from '../types';

export function isWorkflowTerminal(status: RunWorkflowStatus): boolean {
  return status !== 'pending' && status !== 'running';
}

export function deriveWorkflowStatus(stepReports: RunStepReport[]): RunWorkflowStatus {
  if (stepReports.some((step) => step.status === 'error' || step.status === 'warning')) {
    return 'warning';
  }
  return 'complete';
}

export function derivePipelineStatus(run: PipelineRun): RunStatus {
  if (run.collectStatus === 'error' || run.processStatus === 'error') {
    return 'error';
  }
  if (run.collectStatus === 'warning' || run.processStatus === 'warning') {
    return 'warning';
  }
  return 'complete';
}

export async function startTrackedWorkflow(
  env: Env,
  params: RunWorkflowParams,
  workflowName: RunWorkflowName,
  workflowId: string,
  workflowStartedAt: string
): Promise<void> {
  await markPipelineWorkflowStarted(env.DB, {
    runId: params.pipelineRunId,
    triggerType: params.triggerType,
    triggerSource: params.triggerSource,
    runStartedAt: params.startedAt,
    workflowName,
    workflowId,
    workflowStartedAt,
  });
}

export async function recordTrackedStep(
  env: Env,
  runId: string,
  workflowName: RunWorkflowName,
  step: RunStepReport
): Promise<void> {
  await recordPipelineRunStep(env.DB, runId, workflowName, step);
}

export async function finishTrackedWorkflow(
  env: Env,
  runId: string,
  workflowName: RunWorkflowName,
  workflowStatus: RunWorkflowStatus,
  completedAt: string
): Promise<void> {
  await finishPipelineWorkflow(env.DB, {
    runId,
    workflowName,
    status: workflowStatus,
    completedAt,
  });

  const run = await getPipelineRunById(env.DB, runId);
  if (!run || !isWorkflowTerminal(run.collectStatus) || !isWorkflowTerminal(run.processStatus)) {
    return;
  }

  await updatePipelineRunStatus(
    env.DB,
    runId,
    derivePipelineStatus(run),
    run.completedAt ?? completedAt
  );
}

export async function maybeFinalizePipelineRun(
  env: Env,
  runId: string
): Promise<void> {
  const run = await getPipelineRunById(env.DB, runId);
  if (!run || !isWorkflowTerminal(run.collectStatus) || !isWorkflowTerminal(run.processStatus)) {
    return;
  }

  if (!run.completedAt) {
    await updatePipelineRunStatus(env.DB, runId, derivePipelineStatus(run), new Date().toISOString());
  }

  const claimed = await claimPipelineRunRetrospective(env.DB, runId);
  if (!claimed) {
    return;
  }

  try {
    const refreshedRun = await getPipelineRunById(env.DB, runId);
    if (!refreshedRun) {
      throw new Error(`Pipeline run ${runId} not found after claim`);
    }
    const steps = await getPipelineRunSteps(env.DB, runId);

    // Quiet-run gate: if the cron didn't actually do anything interesting,
    // skip the Sonnet retrospective call. The pipeline runs hourly and most
    // off-peak hours produce zero new articles; an LLM retrospective of
    // "everything was 0" burns ~$0.05 of API budget for no signal.
    if (!shouldGenerateRetrospective(steps)) {
      await savePipelineRunRetrospective(env.DB, runId, {
        summary:
          'Quiet run — no new articles ingested or processed, no errors. AI retrospective skipped.',
        wentWell: [],
        didntGoWell: [],
        followUps: [],
        generatedAt: new Date().toISOString(),
      });
      return;
    }

    const retrospective = await generateRunRetrospective(refreshedRun, steps, env);
    await savePipelineRunRetrospective(env.DB, runId, retrospective);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failPipelineRunRetrospective(env.DB, runId, message);
  }
}

/**
 * Decide whether a pipeline run is worth a Sonnet retrospective.
 *
 * The retrospective adds real value when something changed (new articles
 * scored, new companies discovered, pages re-rendered) or something broke
 * (any step in error/warning). On a fully quiet run — zero new articles,
 * zero scoring, zero matches, all steps ok or skipped — the LLM output is
 * a generic "everything ran fine, no issues" essay that nobody reads.
 *
 * Skips ~70% of hourly runs at this site's current activity, cutting
 * ~$25-35/month of Sonnet spend.
 */
export function shouldGenerateRetrospective(
  steps: PipelineRunStep[]
): boolean {
  for (const step of steps) {
    if (step.status === 'error' || step.status === 'warning') return true;
    const m = step.metrics;
    if (!m) continue;
    if (numericMetric(m.scored) > 0) return true;
    if (numericMetric(m.inserted) > 0) return true;
    if (numericMetric(m.newArticles) > 0) return true;
    if (numericMetric(m.matchedArticles) > 0) return true;
    if (numericMetric(m.discovered) > 0) return true;
    if (numericMetric(m.pagesWritten) > 0) return true;
  }
  return false;
}

function numericMetric(v: unknown): number {
  return typeof v === 'number' ? v : 0;
}
