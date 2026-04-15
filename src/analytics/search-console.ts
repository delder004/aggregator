import type { Env } from '../types';
import { BLOB_NAMESPACES, SEARCH_CONSOLE_BUDGET } from './budgets';
import { writeBlob } from './blob-store';
import { getPreviousWeeklyWindow, parseStrictIsoTimestamp } from './window';
import {
  claimSearchConsoleSnapshot,
  completeSearchConsoleSnapshot,
  failSearchConsoleSnapshot,
} from './db';

/**
 * Google Search Console client + weekly snapshot writer.
 *
 * Pulls three distinct views for one closed weekly window and persists:
 *   - authoritative totals from a dimensions:[] query → D1 metadata
 *   - top queries (dimensions:['query']) → KV payload under topQueries
 *   - top pages (dimensions:['page']) → KV payload under topPages
 *
 * Key correctness facts:
 *
 * Totals MUST come from a no-dimensions query. Google's docs for
 * searchAnalytics.query say breaking results down by query or page
 * causes some rows to be dropped, so summing a dimensioned response
 * understates the true totals. We issue a third dedicated call with
 * dimensions:[] and use its single row as the authoritative totals
 * written to search_console_snapshots. topQueries and topPages are
 * explicitly top-N and are NOT summed for D1 totals.
 *
 * GSC dates are Pacific Time; weekly UTC windows can't map to PT days
 * without compromise. There is no 7-PT-day range that exactly matches a
 * 7-UTC-day range. The options are:
 *   (a) widen to 8 PT days that fully cover the UTC week — non-truncating
 *       but creates a one-day overlap with the adjacent week's snapshot,
 *       which would double-count in any multi-snapshot rollup
 *   (b) choose a non-overlapping 7-PT-day range — necessarily phase-shifted
 *       from the UTC window by the PT/UTC offset (~7-8 hours) since
 *       UTC Monday midnight is Sunday afternoon PT
 *   (c) store PT-native window identity instead of UTC, forking the
 *       snapshot framework
 *
 * We pick (b). Rule: interpret the YYYY-MM-DD date-portion of windowStart
 * directly as a PT date (`startDate`), and compute `endDate` by adding
 * (durationDays - 1) PT calendar days. For a canonical UTC [Mon 00:00Z,
 * next Mon 00:00Z) week this yields PT [Mon, Sun] — the same calendar
 * shape, phase-shifted forward by the PT offset. Consecutive weekly
 * snapshots tile exactly (non-overlapping) and the data is "approximately
 * this week" within ~7 hours, which is well below the GSC data-freshness
 * lag anyway.
 *
 * Consumers must treat the snapshot as "the PT week whose days match the
 * UTC window's date strings" — NOT as "the UTC window's impressions and
 * clicks exactly". For Phase 2 consolidation that reads one snapshot at
 * a time and feeds its totals to Sonnet, this distinction doesn't matter.
 * For any future code that sums across weeks, the non-overlap is
 * load-bearing correctness.
 *
 * D1 identity stays keyed on the UTC window (consistent with the other
 * namespaces). The PT date range is a GSC-query-parameter detail
 * surfaced in the KV payload as gscStartDate / gscEndDate.
 *
 * Auth: OAuth2 refresh-token flow. The refresh token is obtained via a
 * one-time consent flow by the operator and stored as GSC_REFRESH_TOKEN;
 * every snapshot run exchanges it for a short-lived access token via the
 * Google token endpoint, then uses that for the GSC API calls. Access
 * tokens are not cached across invocations — Workers isolates between
 * invocations anyway, and the token exchange is one extra subrequest.
 *
 * GSC has ~2-3 day data-freshness lag. Snapshotting the previous complete
 * week on Monday means the most-recent day may still be partially
 * backfilled on the first read; operators can manually re-trigger later
 * via the backfill endpoint.
 *
 * Four subrequests per run: 1 OAuth exchange + 3 GSC queries (totals +
 * top queries + top pages).
 */

const GOOGLE_OAUTH_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const GSC_API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';

export interface SearchConsoleSnapshotOptions {
  windowStart?: string;
  windowEnd?: string;
  siteUrl?: string;
}

export interface GscRow {
  key: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchConsoleTotals {
  /** Authoritative, from GSC dimensions:[] query. */
  impressions: number;
  /** Authoritative, from GSC dimensions:[] query. */
  clicks: number;
  /** Authoritative avg CTR returned by GSC (not recomputed). */
  ctr: number;
  /** Authoritative avg position returned by GSC (not recomputed). */
  position: number;
}

export interface SearchConsoleRawPayload {
  windowStart: string;
  windowEnd: string;
  /**
   * PT calendar date, inclusive. Derived from the UTC date-portion of
   * windowStart. See the file header for the PT/UTC mapping policy and
   * the ~7-hour phase shift this implies.
   */
  gscStartDate: string;
  /**
   * PT calendar date, inclusive. `gscStartDate + (durationDays - 1)`.
   */
  gscEndDate: string;
  siteUrl: string;
  /** From dimensions:[] query — authoritative totals. */
  totals: SearchConsoleTotals;
  /** From dimensions:['query'] — top N, NOT a complete enumeration. */
  topQueries: GscRow[];
  /** From dimensions:['page'] — top N, NOT a complete enumeration. */
  topPages: GscRow[];
}

export interface SearchConsoleRunResult {
  written: boolean;
  reason?: string;
  data?: SearchConsoleRawPayload;
  blobKey?: string;
}

export async function runSearchConsoleSnapshot(
  env: Env,
  options: SearchConsoleSnapshotOptions = {}
): Promise<SearchConsoleRunResult> {
  if (!env.GSC_CLIENT_ID || !env.GSC_CLIENT_SECRET || !env.GSC_REFRESH_TOKEN) {
    throw new Error(
      'GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN are required for the Search Console snapshot'
    );
  }
  const siteUrl = options.siteUrl ?? env.GSC_SITE_URL;
  if (!siteUrl) {
    throw new Error(
      'siteUrl (GSC_SITE_URL env or options.siteUrl) is required for the Search Console snapshot'
    );
  }

  const { windowStart, windowEnd } = resolveSearchConsoleWindow(options);
  const { startDate: gscStartDate, endDate: gscEndDate } = toGscDateRange(
    windowStart,
    windowEnd
  );

  const claim = await claimSearchConsoleSnapshot(env.DB, windowStart, windowEnd);
  if (!claim) {
    return {
      written: false,
      reason: 'window already complete or held by a fresh active claim',
    };
  }

  try {
    const accessToken = await exchangeRefreshToken(env);
    const [totals, topQueries, topPages] = await Promise.all([
      fetchSearchAnalyticsTotals(siteUrl, accessToken, gscStartDate, gscEndDate),
      fetchSearchAnalyticsRows(
        siteUrl,
        accessToken,
        gscStartDate,
        gscEndDate,
        'query'
      ),
      fetchSearchAnalyticsRows(
        siteUrl,
        accessToken,
        gscStartDate,
        gscEndDate,
        'page'
      ),
    ]);

    const payload: SearchConsoleRawPayload = {
      windowStart,
      windowEnd,
      gscStartDate,
      gscEndDate,
      siteUrl,
      totals,
      topQueries,
      topPages,
    };

    const blob = await writeBlob(
      env.KV,
      BLOB_NAMESPACES.searchConsole,
      windowStart,
      claim.id,
      payload
    );

    const ok = await completeSearchConsoleSnapshot(
      env.DB,
      windowStart,
      windowEnd,
      claim.attemptCount,
      {
        blobKey: blob.key,
        totalImpressions: totals.impressions,
        totalClicks: totals.clicks,
        avgCtr: totals.ctr,
        avgPosition: totals.position,
        queriesCount: topQueries.length,
        pagesCount: topPages.length,
      }
    );
    if (!ok) {
      return {
        written: false,
        reason: 'snapshot was reclaimed by another worker mid-flight',
        blobKey: blob.key,
      };
    }
    return { written: true, data: payload, blobKey: blob.key };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await failSearchConsoleSnapshot(
      env.DB,
      windowStart,
      windowEnd,
      claim.attemptCount,
      message
    );
    throw err;
  }
}

/**
 * Validate + canonicalize a manual window override, or default to the
 * previous complete weekly window. Identical contract to
 * cloudflare.ts:resolveSnapshotWindow — strict ISO 8601 required, both
 * bounds or neither, empty windows rejected.
 *
 * Exported for direct unit testing.
 */
export function resolveSearchConsoleWindow(
  options: SearchConsoleSnapshotOptions
): { windowStart: string; windowEnd: string } {
  if (options.windowStart && options.windowEnd) {
    const startMs = parseStrictIsoTimestamp(options.windowStart);
    const endMs = parseStrictIsoTimestamp(options.windowEnd);
    if (startMs === null || endMs === null) {
      throw new Error(
        `windowStart and windowEnd must be strict ISO 8601 timestamps with ` +
          `an explicit Z or ±HH:MM offset (got ${options.windowStart}, ${options.windowEnd})`
      );
    }
    if (startMs >= endMs) {
      throw new Error(
        `Window is empty: windowStart=${options.windowStart}, windowEnd=${options.windowEnd}`
      );
    }
    return {
      windowStart: new Date(startMs).toISOString(),
      windowEnd: new Date(endMs).toISOString(),
    };
  }
  if (options.windowStart || options.windowEnd) {
    throw new Error(
      'windowStart and windowEnd must both be provided or both omitted'
    );
  }
  return getPreviousWeeklyWindow();
}

/**
 * Add an integer number of calendar days to a YYYY-MM-DD date string.
 * Treats the input as a pure calendar date (no timezone) using UTC-anchored
 * epoch-ms arithmetic, so the result is DST-agnostic: the output is "N
 * calendar days after the input" regardless of real-world wall-clock
 * transitions.
 */
function addDaysToDate(dateStr: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new Error(`Invalid date for addDaysToDate: ${dateStr}`);
  }
  const [y, m, d] = dateStr.split('-').map(Number);
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Map a half-open UTC ISO window [windowStart, windowEnd) to the non-
 * overlapping 7-PT-day range documented in the file header.
 *
 * Contract:
 *   - Both windowStart and windowEnd MUST fall on UTC midnight
 *     (epoch-ms divisible by 86_400_000). Partial-day windows are
 *     rejected because they would silently coerce to the wrong day
 *     count — e.g., [Apr 6 12:00Z, Apr 9 00:00Z) is 2.5 days, and any
 *     rounding policy would map it to an incorrect PT date range.
 *   - windowEnd must be strictly after windowStart.
 *
 * Rule:
 *   - startDate = UTC date-portion of windowStart, reinterpreted as a PT
 *     calendar date
 *   - durationDays = whole UTC days in the window
 *   - endDate = startDate + (durationDays - 1) PT calendar days, inclusive
 *
 * For a canonical UTC [Mon 00:00Z, next Mon 00:00Z) week this yields PT
 * [Mon, Sun] — same calendar-day shape as the UTC window, phase-shifted
 * forward by the PT/UTC offset. Consecutive weekly snapshots tile
 * exactly and are non-overlapping, which is load-bearing for any future
 * code that sums across snapshots.
 *
 * Exported for direct unit testing — the boundary math is easy to get
 * wrong.
 */
export function toGscDateRange(
  windowStart: string,
  windowEnd: string
): { startDate: string; endDate: string } {
  const startMs = Date.parse(windowStart);
  const endMs = Date.parse(windowEnd);
  if (Number.isNaN(startMs)) {
    throw new Error(`Invalid windowStart for GSC date range: ${windowStart}`);
  }
  if (Number.isNaN(endMs)) {
    throw new Error(`Invalid windowEnd for GSC date range: ${windowEnd}`);
  }
  if (endMs <= startMs) {
    throw new Error(
      `GSC window is empty or inverted: windowStart=${windowStart}, windowEnd=${windowEnd}`
    );
  }
  // Whole-UTC-day invariant. UTC has no DST; every UTC day is exactly
  // 86_400_000 ms, so midnight-alignment is a pure divisibility check.
  const MS_PER_DAY = 86_400_000;
  if (startMs % MS_PER_DAY !== 0 || endMs % MS_PER_DAY !== 0) {
    throw new Error(
      `GSC window bounds must fall on UTC midnight (got windowStart=${windowStart}, windowEnd=${windowEnd})`
    );
  }
  const durationDays = (endMs - startMs) / MS_PER_DAY;
  // Take the UTC date portion of the parsed instant, NOT a raw slice of
  // the input string. For a canonical `...T00:00:00Z` input the two agree,
  // but for a non-UTC offset like `2026-04-05T17:00:00-07:00` (same
  // instant as `2026-04-06T00:00:00Z`) a raw slice yields the local date
  // in the provided offset, which is the wrong day.
  const startDate = new Date(startMs).toISOString().slice(0, 10);
  const endDate = addDaysToDate(startDate, durationDays - 1);
  return { startDate, endDate };
}

async function exchangeRefreshToken(env: Env): Promise<string> {
  const params = new URLSearchParams({
    client_id: env.GSC_CLIENT_ID!,
    client_secret: env.GSC_CLIENT_SECRET!,
    refresh_token: env.GSC_REFRESH_TOKEN!,
    grant_type: 'refresh_token',
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SEARCH_CONSOLE_BUDGET.apiTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Google OAuth token exchange ${response.status}: ${body.slice(0, 500)}`
    );
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error('Google OAuth response missing access_token');
  }
  return data.access_token;
}

interface SearchAnalyticsApiRow {
  keys?: string[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
}

interface SearchAnalyticsApiResponse {
  rows?: SearchAnalyticsApiRow[];
  responseAggregationType?: string;
}

async function postSearchAnalyticsQuery(
  siteUrl: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<SearchAnalyticsApiResponse> {
  const encodedSite = encodeURIComponent(siteUrl);
  const url = `${GSC_API_BASE}/sites/${encodedSite}/searchAnalytics/query`;

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SEARCH_CONSOLE_BUDGET.apiTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Google Search Console API ${response.status}: ${responseBody.slice(0, 500)}`
    );
  }

  return (await response.json()) as SearchAnalyticsApiResponse;
}

/**
 * Fetch the authoritative totals for a PT date range using a no-dimensions
 * query. Per Google's docs this returns either one row (aggregate across
 * all queries and pages) or zero rows (no data). We use this for the D1
 * metadata columns rather than summing dimensioned responses, which drop
 * rows and understate the true totals.
 */
async function fetchSearchAnalyticsTotals(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string
): Promise<SearchConsoleTotals> {
  const data = await postSearchAnalyticsQuery(siteUrl, accessToken, {
    startDate,
    endDate,
    dimensions: [],
    rowLimit: 1,
  });
  const row = data.rows?.[0];
  if (!row) {
    return { impressions: 0, clicks: 0, ctr: 0, position: 0 };
  }
  return {
    impressions: numberOrZero(row.impressions),
    clicks: numberOrZero(row.clicks),
    ctr: numberOrZero(row.ctr),
    position: numberOrZero(row.position),
  };
}

/**
 * Fetch top N rows for a single dimension. These are explicitly top-N
 * and NOT a complete enumeration — GSC drops long-tail rows. Do not sum
 * across them for totals; use fetchSearchAnalyticsTotals instead.
 */
async function fetchSearchAnalyticsRows(
  siteUrl: string,
  accessToken: string,
  startDate: string,
  endDate: string,
  dimension: 'query' | 'page'
): Promise<GscRow[]> {
  const data = await postSearchAnalyticsQuery(siteUrl, accessToken, {
    startDate,
    endDate,
    dimensions: [dimension],
    rowLimit: SEARCH_CONSOLE_BUDGET.rowLimit,
  });
  return (data.rows ?? []).map((row) => ({
    key: String(row.keys?.[0] ?? ''),
    clicks: numberOrZero(row.clicks),
    impressions: numberOrZero(row.impressions),
    ctr: numberOrZero(row.ctr),
    position: numberOrZero(row.position),
  }));
}

function numberOrZero(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
