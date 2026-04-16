import type { Env } from '../types';
import { BLOB_NAMESPACES, COMPETITOR_BUDGET } from '../analytics/budgets';
import { writeBlob } from '../analytics/blob-store';
import { getWeeklyWindow, getPreviousWeeklyWindow, parseStrictIsoTimestamp } from '../analytics/window';
import {
  claimCompetitorSnapshot,
  completeCompetitorSnapshot,
  failCompetitorSnapshot,
} from '../analytics/db';
import type { CompetitorConfig } from './config';
import { COMPETITORS } from './config';
import { fetchCompetitorContent } from './fetch';

/**
 * Weekly competitor snapshot writer.
 *
 * For each competitor in the config, fetches content (RSS or homepage
 * scraping) and persists:
 *   - queryable metadata (item count, HTML hash, status) to
 *     competitor_snapshots in D1, one row per (competitor_slug, window)
 *   - full item list + errors to KV under
 *     competitors/<windowStart>/<id>.json
 *
 * Window semantics: same as CF analytics and Search Console — snapshot
 * the previous complete weekly window. Current week is excluded because
 * competitor content is still being published.
 *
 * Budget: max 10 competitors × (1 homepage + 1 RSS) = 20 subrequests
 * ceiling. Each competitor is independent; one failure doesn't block
 * others.
 *
 * Idempotency: per-competitor claim/complete/fail with the same
 * attempt_count guard as the other snapshot writers.
 */

export interface CompetitorSnapshotOptions {
  /** Override: "snapshot the completed week containing this instant." */
  windowStart?: string;
  competitors?: readonly CompetitorConfig[];
}

export interface CompetitorSnapshotRunResult {
  windowStart: string;
  windowEnd: string;
  totalCompetitors: number;
  completedCount: number;
  skippedCount: number;
  failedCount: number;
  results: CompetitorSnapshotSingleResult[];
}

export interface CompetitorSnapshotSingleResult {
  slug: string;
  written: boolean;
  reason?: string;
  itemsCount: number;
  errors: string[];
  blobKey?: string;
}

export async function runCompetitorSnapshots(
  env: Env,
  options: CompetitorSnapshotOptions = {}
): Promise<CompetitorSnapshotRunResult> {
  const competitors = (options.competitors ?? COMPETITORS).slice(
    0,
    COMPETITOR_BUDGET.maxCompetitors
  );
  const { windowStart, windowEnd } = resolveCompetitorWindow(options);

  const results: CompetitorSnapshotSingleResult[] = [];
  // Run competitors sequentially to keep subrequest timing predictable
  // and avoid burst-throttling from competitor sites.
  for (const competitor of competitors) {
    const result = await snapshotOneCompetitor(
      env,
      competitor,
      windowStart,
      windowEnd
    );
    results.push(result);
  }

  const completedCount = results.filter((r) => r.written).length;
  // "skipped" = writer decided not to write (claim-null or reclaimed),
  // regardless of whether the competitor's site had errors.
  // "failed" = writer itself threw (KV/D1 failure, not site noise).
  const skippedCount = results.filter(
    (r) => !r.written && r.reason !== undefined
  ).length;
  const failedCount = results.filter(
    (r) => !r.written && r.reason === undefined
  ).length;

  return {
    windowStart,
    windowEnd,
    totalCompetitors: competitors.length,
    completedCount,
    skippedCount,
    failedCount,
    results,
  };
}

/**
 * Resolve the snapshot window, defaulting to the previous complete weekly
 * window.
 *
 * Override semantics: "snapshot the week CONTAINING this instant." An
 * instant inside the week of Apr 6–12 resolves to [Apr 6, Apr 13),
 * not the week before. This uses getWeeklyWindow() (maps instant to
 * its Monday bucket).
 *
 * Default (no override): the previous complete weekly window via
 * getPreviousWeeklyWindow(). The weekly cron fires during week W+1 and
 * should capture the just-completed week W, so the default is one week
 * behind.
 *
 * The competitor schema keys on (competitor_slug, window_start), so
 * windowEnd must always be deterministic from windowStart. Normalizing
 * to the weekly bucket guarantees windowEnd is always
 * windowStart + 7 days.
 *
 * Exported for direct unit testing.
 */
export function resolveCompetitorWindow(
  options: CompetitorSnapshotOptions
): { windowStart: string; windowEnd: string } {
  if (options.windowStart) {
    const ms = parseStrictIsoTimestamp(options.windowStart);
    if (ms === null) {
      throw new Error(
        `windowStart must be a strict ISO 8601 timestamp with an explicit ` +
          `Z or ±HH:MM offset (got ${options.windowStart})`
      );
    }
    return getWeeklyWindow(new Date(ms));
  }
  return getPreviousWeeklyWindow();
}

async function snapshotOneCompetitor(
  env: Env,
  competitor: CompetitorConfig,
  windowStart: string,
  windowEnd: string
): Promise<CompetitorSnapshotSingleResult> {
  const claim = await claimCompetitorSnapshot(
    env.DB,
    competitor.slug,
    windowStart,
    windowEnd
  );
  if (!claim) {
    return {
      slug: competitor.slug,
      written: false,
      reason: 'window already complete or held by a fresh active claim',
      itemsCount: 0,
      errors: [],
    };
  }

  try {
    const content = await fetchCompetitorContent(
      competitor.homepageUrl,
      competitor.rssUrl
    );

    const blobPayload = {
      slug: competitor.slug,
      name: competitor.name,
      bucket: competitor.bucket,
      windowStart,
      windowEnd,
      items: content.items,
      homepageHtmlHash: content.homepageHtmlHash,
      fetchedHomepage: content.fetchedHomepage,
      fetchedRss: content.fetchedRss,
      errors: content.errors,
    };

    const blob = await writeBlob(
      env.KV,
      BLOB_NAMESPACES.competitors,
      windowStart,
      claim.id,
      blobPayload
    );

    const ok = await completeCompetitorSnapshot(
      env.DB,
      competitor.slug,
      windowStart,
      claim.attemptCount,
      {
        blobKey: blob.key,
        itemsCount: content.items.length,
        homepageHtmlHash: content.homepageHtmlHash,
      }
    );

    if (!ok) {
      return {
        slug: competitor.slug,
        written: false,
        reason: 'snapshot was reclaimed by another worker mid-flight',
        itemsCount: content.items.length,
        errors: content.errors,
        blobKey: blob.key,
      };
    }

    return {
      slug: competitor.slug,
      written: true,
      itemsCount: content.items.length,
      errors: content.errors,
      blobKey: blob.key,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failCompetitorSnapshot(
      env.DB,
      competitor.slug,
      windowStart,
      claim.attemptCount,
      message
    ).catch(() => {
      // If even the failure record fails (DB down), we still propagate.
    });
    return {
      slug: competitor.slug,
      written: false,
      itemsCount: 0,
      errors: [message],
    };
  }
}
