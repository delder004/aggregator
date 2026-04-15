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
    const retrospective = await generateRunRetrospective(refreshedRun, steps, env);
    await savePipelineRunRetrospective(env.DB, runId, retrospective);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failPipelineRunRetrospective(env.DB, runId, message);
  }
}
