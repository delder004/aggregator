/**
 * Pipeline step: scrape job boards for tracked companies.
 *
 * The step is gated on a 23-hour cooldown via KV (`shouldFetchJobs`). The
 * cooldown check is cheap, so it runs OUTSIDE step.do as a shouldRun
 * predicate — when on cooldown we never pay the durable-execution cost.
 */

import type { Env } from '../../types';
import {
  collectAllJobs,
  markJobsFetched,
  shouldFetchJobs,
} from '../../collectors/jobs';
import { getTrackedCompanies } from '../../company/tracker';
import type { StepOutcome } from '../step-runner';

export interface CollectJobsResult {
  fetched: number;
  companies: number;
  error?: string;
}

export function shouldRunCollectJobs(env: Env): Promise<boolean> {
  return shouldFetchJobs(env.KV);
}

export async function collectJobsStep(
  env: Env
): Promise<StepOutcome<CollectJobsResult>> {
  try {
    const companies = await getTrackedCompanies(env.DB);
    const result = await collectAllJobs(env.DB, companies);
    await markJobsFetched(env.KV);
    return {
      status: 'ok',
      metrics: {
        fetched: result.fetched,
        companies: result.companies,
      },
      result: { fetched: result.fetched, companies: result.companies },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Job collection failed:', err);
    return {
      status: 'error',
      metrics: { fetched: 0, companies: 0 },
      errors: [message],
      result: { fetched: 0, companies: 0, error: message },
    };
  }
}
