/**
 * Pipeline step runner.
 *
 * Compresses the per-step boilerplate (startedAt → step.do → recordStep with
 * status / metrics / notes / errors) that the Collect/Process workflows used
 * to inline around every step. Each step body becomes a self-contained
 * function returning a StepOutcome; the workflow class just calls runStep().
 *
 * Two extra wins over the inline pattern:
 *  1. Optional shouldRun() pre-check bypasses step.do entirely for no-op
 *     steps (e.g. newsletter-draft on non-newsletter days). Saves the
 *     durable-execution overhead for steps that have nothing to do.
 *  2. recordTrackedStep failures never propagate — tracking is best-effort
 *     and shouldn't break the pipeline if D1 hiccups.
 */

import type { WorkflowStep } from 'cloudflare:workers';
import type {
  Env,
  RunMetricValue,
  RunStepReport,
  RunStepStatus,
  RunWorkflowParams,
} from '../types';
import { recordTrackedStep } from '../runs/service';

export type WorkflowName = 'collect' | 'process';

/**
 * Type alias for step.do's options bag — keeps our retry config in sync
 * with Cloudflare's runtime types (WorkflowSleepDuration literal union,
 * etc.) without re-typing them.
 */
type StepDoOptions = NonNullable<Parameters<WorkflowStep['do']>[1]>;
type StepDoRetries = NonNullable<StepDoOptions['retries']>;

export interface StepOutcome<R = void> {
  status: RunStepStatus;
  metrics?: Record<string, RunMetricValue>;
  notes?: string[];
  errors?: string[];
  /** Domain-specific result the workflow needs to thread to later steps. */
  result?: R;
}

export interface RunStepSpec<R> {
  name: string;
  retries?: StepDoRetries;
  /**
   * Cheap synchronous-or-async predicate evaluated OUTSIDE step.do. If it
   * returns false, the step is recorded as 'skipped' without entering the
   * durable step at all.
   */
  shouldRun?: () => Promise<boolean> | boolean;
  /** Note written to the skipped-step report when shouldRun returns false. */
  skipReason?: string;
  fn: () => Promise<StepOutcome<R>>;
}

export async function runStep<R>(
  env: Env,
  step: WorkflowStep,
  params: RunWorkflowParams,
  workflowName: WorkflowName,
  reports: RunStepReport[],
  spec: RunStepSpec<R>
): Promise<R | undefined> {
  const startedAt = nowIso();

  if (spec.shouldRun) {
    const should = await spec.shouldRun();
    if (!should) {
      const report: RunStepReport = {
        stepName: spec.name,
        status: 'skipped',
        startedAt,
        completedAt: nowIso(),
        notes: spec.skipReason ? [spec.skipReason] : [],
      };
      reports.push(report);
      await safeRecordStep(env, params.pipelineRunId, workflowName, report);
      return undefined;
    }
  }

  // Outcome returns through step.do, which serializes via JSON. The cast
  // is safe because every StepOutcome field is JSON-friendly (status is a
  // string union, metrics is Record<string, RunMetricValue>, etc.) and R
  // is constrained by callers to JSON-shaped data they own. Cloudflare's
  // Serializable<T> generic can't be proven for an opaque R, so we narrow
  // step.do's signature at the call site rather than carry the constraint
  // through every step-body function.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const doFn = step.do as unknown as (
    name: string,
    optsOrFn: StepDoOptions | (() => Promise<unknown>),
    maybeFn?: () => Promise<unknown>
  ) => Promise<unknown>;
  const raw = spec.retries
    ? await doFn(spec.name, { retries: spec.retries }, spec.fn)
    : await doFn(spec.name, spec.fn);
  const outcome = raw as StepOutcome<R>;

  const report: RunStepReport = {
    stepName: spec.name,
    status: outcome.status,
    startedAt,
    completedAt: nowIso(),
    metrics: outcome.metrics,
    notes: outcome.notes,
    errors: outcome.errors,
  };
  reports.push(report);
  await safeRecordStep(env, params.pipelineRunId, workflowName, report);

  return outcome.result;
}

function nowIso(): string {
  return new Date().toISOString();
}

async function safeRecordStep(
  env: Env,
  pipelineRunId: string,
  workflowName: WorkflowName,
  report: RunStepReport
): Promise<void> {
  try {
    await recordTrackedStep(env, pipelineRunId, workflowName, report);
  } catch (err) {
    console.error(
      `[RunTracker] ${workflowName}/${report.stepName} failed:`,
      err
    );
  }
}
