/**
 * Pipeline step: draft the weekly newsletter via Buttondown.
 *
 * Three preconditions, all in shouldRun() so 6 out of 7 days never pay
 * the step.do overhead:
 *   1. BUTTONDOWN_API_KEY is configured
 *   2. It's Monday UTC
 *   3. No draft has been created in the last 6 days
 */

import type { Env } from '../../types';
import { getPublishedArticles } from '../../db/queries';
import { generateWeeklyNewsletter } from '../../renderer/newsletter';
import { createNewsletterDraft } from '../../newsletter/buttondown';
import { MIN_PUBLISH_SCORE } from '../../scoring/classifier';
import type { StepOutcome } from '../step-runner';

const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
const LAST_DRAFT_KEY = 'newsletter:last_draft';

export interface NewsletterDraftResult {
  created: boolean;
  error?: string;
}

export async function shouldRunNewsletter(env: Env): Promise<boolean> {
  if (!env.BUTTONDOWN_API_KEY) return false;
  if (new Date().getUTCDay() !== 1) return false;
  const lastDraft = await env.KV.get(LAST_DRAFT_KEY);
  if (lastDraft) {
    const elapsed = Date.now() - new Date(lastDraft).getTime();
    if (elapsed < SIX_DAYS_MS) return false;
  }
  return true;
}

export async function newsletterDraftStep(
  env: Env
): Promise<StepOutcome<NewsletterDraftResult>> {
  try {
    const articles = await getPublishedArticles(env.DB, {
      limit: 50,
      minScore: MIN_PUBLISH_SCORE,
    });
    const { subject, body } = generateWeeklyNewsletter(articles);

    const apiKey = env.BUTTONDOWN_API_KEY;
    if (!apiKey) {
      // shouldRun should have caught this, but defend against a race.
      return {
        status: 'skipped',
        metrics: { created: false },
        notes: ['BUTTONDOWN_API_KEY not configured.'],
        result: { created: false },
      };
    }
    const ok = await createNewsletterDraft(apiKey, subject, body);
    if (ok) {
      await env.KV.put(LAST_DRAFT_KEY, new Date().toISOString());
    }

    return {
      status: ok ? 'ok' : 'warning',
      metrics: { created: ok },
      errors: ok ? [] : ['Newsletter draft creation returned false.'],
      result: { created: ok },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Newsletter draft failed:', err);
    return {
      status: 'error',
      metrics: { created: false },
      errors: [message],
      result: { created: false, error: message },
    };
  }
}
