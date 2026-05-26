/**
 * Pipeline step: load active sources from D1.
 *
 * Status semantics:
 *   - ok: at least one active source loaded
 *   - warning: query succeeded but returned zero sources (nothing to crawl)
 *   - on D1 error: swallowed, returns empty array, warning status
 */

import type { Env, SourceConfig } from '../../types';
import { getAllActiveSources } from '../../db/queries';
import type { StepOutcome } from '../step-runner';

export async function loadSourcesStep(
  env: Env
): Promise<StepOutcome<SourceConfig[]>> {
  let sources: SourceConfig[] = [];
  try {
    sources = await getAllActiveSources(env.DB);
    console.log(`Loaded ${sources.length} active sources`);
  } catch (err) {
    console.error('Failed to load sources:', err);
  }
  return {
    status: sources.length > 0 ? 'ok' : 'warning',
    metrics: { sources: sources.length },
    notes: sources.length > 0 ? [] : ['No active sources were loaded.'],
    result: sources,
  };
}
