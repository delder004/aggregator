import type { Env } from '../types';
import { BLOB_NAMESPACES, CF_ANALYTICS_BUDGET } from './budgets';
import { writeBlob } from './blob-store';
import { getPreviousWeeklyWindow, parseStrictIsoTimestamp } from './window';
import {
  claimCfAnalyticsSnapshot,
  completeCfAnalyticsSnapshot,
  failCfAnalyticsSnapshot,
} from './db';

/**
 * Cloudflare GraphQL Analytics client + weekly snapshot writer.
 *
 * Reads zone-level traffic data from the CF GraphQL API
 * (httpRequestsAdaptiveGroups dataset) for a single closed weekly window and
 * persists:
 *   - queryable totals + counts to cf_analytics_snapshots in D1
 *   - the full raw payload (including all top-N arrays) to KV under
 *     cf-analytics/<windowStart>/<id>.json
 *
 * Default window: the previous complete weekly window
 * (getPreviousWeeklyWindow). The current week is intentionally not
 * snapshotted because it is still in progress; a mid-week snapshot would
 * never be overwritten by the next weekly run.
 *
 * Dataset: httpRequests1dGroups (daily rollups, supports weekly+ ranges
 * on all plan tiers). The adaptive-groups dataset limits free/pro plans
 * to 1-day queries, which doesn't work for weekly snapshots.
 *
 * Field-name facts for httpRequests1dGroups:
 *   - total request volume: `sum.requests`
 *   - page views: `sum.pageViews`
 *   - unique visitors: `uniq.uniques`
 *   - byte volume: `sum.bytes`
 *   - cached requests: `sum.cachedRequests`
 *   - sorting top-N: `sum_requests_DESC`
 *   - filter: `date_geq` / `date_lt` (date strings, not datetime)
 *   - cacheStatus breakdown comes from a dimension groupby using
 *     CACHED_STATUS_KEYS (hit, stale, updating, revalidated)
 */

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

// clientRequestReferer is NOT available on httpRequests1dGroups for
// free/pro plan zones. Referrer data comes from Analytics Engine
// (per-article, commit 2) instead.
const CF_GRAPHQL_DIMENSIONS = {
  path: 'clientRequestPath',
  country: 'clientCountryName',
  status: 'edgeResponseStatus',
} as const;


export interface CfAnalyticsSnapshotOptions {
  windowStart?: string;
  windowEnd?: string;
  zoneTag?: string;
}

export interface CfAnalyticsTotals {
  /** From `sum.requests`. */
  requests: number;
  /** From `sum.pageViews`. */
  pageViews: number;
  /** From `uniq.uniques`. */
  uniqueVisitors: number;
  /** From `sum.bytes`. */
  bytes: number;
  /** From `sum.cachedRequests`. */
  cachedRequests: number;
}

export interface CfAnalyticsTopRow {
  key: string;
  /** From `sum.requests`. */
  requests: number;
  /** From `sum.pageViews` (present on the paths subquery only). */
  pageViews?: number;
}

export interface CfAnalyticsRawPayload {
  windowStart: string;
  windowEnd: string;
  zoneTag: string;
  totals: CfAnalyticsTotals;
  topPaths: CfAnalyticsTopRow[];
  topCountries: CfAnalyticsTopRow[];
  statusCodes: CfAnalyticsTopRow[];
}

export interface SnapshotRunResult {
  written: boolean;
  reason?: string;
  data?: CfAnalyticsRawPayload;
  blobKey?: string;
}

export async function runCfAnalyticsSnapshot(
  env: Env,
  options: CfAnalyticsSnapshotOptions = {}
): Promise<SnapshotRunResult> {
  if (!env.CF_ACCOUNT_ID || !env.CF_ANALYTICS_API_TOKEN) {
    throw new Error(
      'CF_ACCOUNT_ID and CF_ANALYTICS_API_TOKEN are required for the CF analytics snapshot'
    );
  }
  const zoneTag = options.zoneTag ?? env.CF_ZONE_ID;
  if (!zoneTag) {
    throw new Error(
      'zoneTag (CF_ZONE_ID env or options.zoneTag) is required for the CF analytics snapshot'
    );
  }

  const { windowStart, windowEnd } = resolveSnapshotWindow(options);

  const claim = await claimCfAnalyticsSnapshot(
    env.DB,
    windowStart,
    windowEnd,
    'graphql'
  );
  if (!claim) {
    return {
      written: false,
      reason: 'window already complete or held by a fresh active claim',
    };
  }

  try {
    const payload = await fetchCfAnalytics(env, {
      windowStart,
      windowEnd,
      zoneTag,
    });
    const blob = await writeBlob(
      env.KV,
      BLOB_NAMESPACES.cfAnalytics,
      windowStart,
      claim.id,
      payload
    );

    const cachedPercentage =
      payload.totals.requests > 0
        ? (payload.totals.cachedRequests / payload.totals.requests) * 100
        : null;

    const ok = await completeCfAnalyticsSnapshot(
      env.DB,
      windowStart,
      windowEnd,
      'graphql',
      claim.attemptCount,
      {
        blobKey: blob.key,
        totalRequests: payload.totals.requests,
        totalPageViews: payload.totals.pageViews,
        totalVisits: null,
        uniqueVisitors: payload.totals.uniqueVisitors,
        cachedPercentage,
        topPathsCount: payload.topPaths.length,
        topReferrersCount: null,
        topCountriesCount: payload.topCountries.length,
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
    await failCfAnalyticsSnapshot(
      env.DB,
      windowStart,
      windowEnd,
      'graphql',
      claim.attemptCount,
      message
    );
    throw err;
  }
}

/**
 * Resolve the snapshot window for CF analytics.
 *
 * Defaults to the previous complete weekly window. Custom overrides must be
 * strict ISO 8601 timestamps with an explicit Z or ±HH:MM offset. After
 * validation, both bounds go through a toISOString() round-trip so that
 * equivalent instants in different formats collapse to a single canonical
 * UTC string. This is load-bearing for the UNIQUE(window_start, window_end,
 * source) claim lock on cf_analytics_snapshots — without canonicalization,
 * `2026-04-06T00:00:00Z` and `2026-04-05T14:00:00-10:00` would create two
 * rows for the same week.
 *
 * Exported for direct unit testing of the validation + canonicalization
 * contract.
 */
export function resolveSnapshotWindow(options: CfAnalyticsSnapshotOptions): {
  windowStart: string;
  windowEnd: string;
} {
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

interface FetchInput {
  windowStart: string;
  windowEnd: string;
  zoneTag: string;
}

interface CfGroupRow {
  sum?: {
    requests?: number;
    pageViews?: number;
    bytes?: number;
    cachedRequests?: number;
  };
  uniq?: { uniques?: number };
  dimensions?: Record<string, string | number>;
}

interface CfGraphQLResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        totals?: CfGroupRow[];
        paths?: CfGroupRow[];
        countries?: CfGroupRow[];
        statuses?: CfGroupRow[];
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchCfAnalytics(
  env: Env,
  input: FetchInput
): Promise<CfAnalyticsRawPayload> {
  const query = buildAnalyticsQuery();
  // httpRequests1dGroups uses date_geq/date_lt with YYYY-MM-DD date strings.
  const variables = {
    zoneTag: input.zoneTag,
    start: input.windowStart.slice(0, 10),
    end: input.windowEnd.slice(0, 10),
    pathLimit: CF_ANALYTICS_BUDGET.topPathsLimit,
    countryLimit: CF_ANALYTICS_BUDGET.topCountriesLimit,
    statusLimit: 25,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    CF_ANALYTICS_BUDGET.graphqlTimeoutMs
  );

  let response: Response;
  try {
    response = await fetch(CF_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_ANALYTICS_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`CF GraphQL ${response.status}: ${body.slice(0, 500)}`);
  }

  const json = (await response.json()) as CfGraphQLResponse;
  if (json.errors && json.errors.length > 0) {
    throw new Error(
      `CF GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`
    );
  }

  return parseAnalyticsResponse(json, input);
}

export function buildAnalyticsQuery(): string {
  const { path, country, status } = CF_GRAPHQL_DIMENSIONS;
  // cacheStatus dimension is not available on httpRequests1dGroups for
  // free/pro zones. cachedRequests is available directly via
  // sum.cachedRequests in the totals row.
  return `query ZoneAnalytics(
  $zoneTag: String!
  $start: Date!
  $end: Date!
  $pathLimit: Int!
  $countryLimit: Int!
  $statusLimit: Int!
) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      totals: httpRequests1dGroups(
        limit: 1
        filter: { date_geq: $start, date_lt: $end }
      ) {
        sum { requests pageViews bytes cachedRequests }
        uniq { uniques }
      }
      paths: httpRequests1dGroups(
        limit: $pathLimit
        filter: { date_geq: $start, date_lt: $end }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests pageViews }
        dimensions { ${path} }
      }
      countries: httpRequests1dGroups(
        limit: $countryLimit
        filter: { date_geq: $start, date_lt: $end }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests }
        dimensions { ${country} }
      }
      statuses: httpRequests1dGroups(
        limit: $statusLimit
        filter: { date_geq: $start, date_lt: $end }
        orderBy: [sum_requests_DESC]
      ) {
        sum { requests }
        dimensions { ${status} }
      }
    }
  }
}`;
}

export function parseAnalyticsResponse(
  json: CfGraphQLResponse,
  input: FetchInput
): CfAnalyticsRawPayload {
  const zone = json.data?.viewer?.zones?.[0];
  const totalsRow = zone?.totals?.[0];
  const { path, country, status } = CF_GRAPHQL_DIMENSIONS;

  const totals: CfAnalyticsTotals = {
    requests: numberOrZero(totalsRow?.sum?.requests),
    pageViews: numberOrZero(totalsRow?.sum?.pageViews),
    uniqueVisitors: numberOrZero(totalsRow?.uniq?.uniques),
    bytes: numberOrZero(totalsRow?.sum?.bytes),
    cachedRequests: numberOrZero(totalsRow?.sum?.cachedRequests),
  };

  return {
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    zoneTag: input.zoneTag,
    totals,
    topPaths: (zone?.paths ?? []).map((row) => ({
      key: String(row.dimensions?.[path] ?? ''),
      requests: numberOrZero(row.sum?.requests),
      pageViews: numberOrZero(row.sum?.pageViews),
    })),
    topCountries: (zone?.countries ?? []).map((row) => ({
      key: String(row.dimensions?.[country] ?? ''),
      requests: numberOrZero(row.sum?.requests),
    })),
    statusCodes: (zone?.statuses ?? []).map((row) => ({
      key: String(row.dimensions?.[status] ?? ''),
      requests: numberOrZero(row.sum?.requests),
    })),
  };
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
