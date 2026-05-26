/**
 * Pipeline step: sync curated company descriptions before rendering.
 *
 * Pulls the canonical descriptions from src/company/descriptions.ts and
 * writes any that differ from the current company rows in D1. Runs every
 * cron because the source-of-truth descriptions can be edited via PR; the
 * batched UPDATE is cheap.
 */

import type { Env } from '../../types';
import { CURATED_DESCRIPTIONS } from '../../company/descriptions';
import { syncCuratedCompanyDescriptions } from '../../db/queries';
import type { StepOutcome } from '../step-runner';

export interface SyncDescriptionsResult {
  updated: number;
  error?: string;
}

export async function syncDescriptionsStep(
  env: Env
): Promise<StepOutcome<SyncDescriptionsResult>> {
  try {
    const updated = await syncCuratedCompanyDescriptions(
      env.DB,
      CURATED_DESCRIPTIONS
    );
    console.log(`Synced ${updated} company descriptions`);
    return {
      status: 'ok',
      metrics: { updated },
      result: { updated },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Description sync failed:', err);
    return {
      status: 'error',
      metrics: { updated: 0 },
      errors: [message],
      result: { updated: 0, error: message },
    };
  }
}
