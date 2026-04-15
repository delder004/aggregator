import type { Env } from '../types';
import { BLOB_NAMESPACES, CF_ANALYTICS_BUDGET } from './budgets';
import { writeBlob } from './blob-store';
import { getPreviousWeeklyWindow } from './window';
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
 * Field-name facts (verified against CF docs for httpRequestsAdaptiveGroups):
 *   - total request volume is the top-level `count` field, NOT `sum.requests`
 *   - `sum.visits` is a VISIT count (session-like aggregation), NOT pageviews.
 *     One visit may contain multiple page views. We store this as `visits`
 *     end-to-end — the D1 total_page_views column stays NULL in Phase 1
 *     until a true page-view data source is wired up.
 *   - byte volume is `sum.edgeResponseBytes`, NOT `sum.bytes`
 *   - unique visitors are NOT supported on this node; the unique_visitors
 *     column in D1 stays NULL in Phase 1
 *   - cached counts are not a sum field; they come from a separate groupby
 *     on the `cacheStatus` dimension. A request is "served from cache" if
 *     its status is hit, stale, updating, or revalidated (per CF cache
 *     docs) — reducing cached to just `hit` undercounts stale-while-
 *     revalidate and synchronous-revalidate traffic.
 *   - sorting top-N uses `count_DESC`, NOT `sum_requests_DESC`
 */

const CF_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

const CF_GRAPHQL_DIMENSIONS = {
  path: 'clientRequestPath',
  referer: 'clientRequestReferer',
  country: 'clientCountryName',
  status: 'edgeResponseStatus',
  cacheStatus: 'cacheStatus',
} as const;

/**
 * cacheStatus values that represent requests served from cache, per
 * https://developers.cloudflare.com/cache/concepts/cache-responses/ and
 * the 2025-12-18 cached-classification changelog.
 *
 * Lowercase because we normalize the dimension value before comparing.
 */
const CACHED_STATUS_KEYS: ReadonlySet<string> = new Set([
  'hit',
  'stale',
  'updating',
  'revalidated',
]);

export interface CfAnalyticsSnapshotOptions {
  windowStart?: string;
  windowEnd?: string;
  zoneTag?: string;
}

export interface CfAnalyticsTotals {
  /** From top-level `count`. */
  requests: number;
  /**
   * From `sum.visits`. A visit is a session-like aggregation and is NOT
   * the same as a page view; one visit can span multiple page views.
   */
  visits: number;
  /** From `sum.edgeResponseBytes`. */
  bytes: number;
  /**
   * Computed: sum of `count` across rows where cacheStatus is one of
   * CACHED_STATUS_KEYS (hit, stale, updating, revalidated).
   */
  cachedRequests: number;
}

export interface CfAnalyticsTopRow {
  key: string;
  /** From top-level `count`. */
  requests: number;
  /** From `sum.visits` (present on the paths subquery only). */
  visits?: number;
}

export interface CfAnalyticsRawPayload {
  windowStart: string;
  windowEnd: string;
  zoneTag: string;
  totals: CfAnalyticsTotals;
  topPaths: CfAnalyticsTopRow[];
  topReferrers: CfAnalyticsTopRow[];
  topCountries: CfAnalyticsTopRow[];
  statusCodes: CfAnalyticsTopRow[];
  cacheStatuses: CfAnalyticsTopRow[];
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
        // total_page_views stays NULL in Phase 1 — sum.visits is a VISIT
        // count, not a pageview count. A future migration can backfill
        // this column from a true pageview source.
        totalPageViews: null,
        totalVisits: payload.totals.visits,
        // httpRequestsAdaptiveGroups does not support unique visitors.
        uniqueVisitors: null,
        cachedPercentage,
        topPathsCount: payload.topPaths.length,
        topReferrersCount: payload.topReferrers.length,
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
 * Strict ISO 8601 timestamp regex. Requires:
 *   - full date: YYYY-MM-DD
 *   - T separator
 *   - full time: HH:MM:SS
 *   - optional fractional seconds (up to 3 digits)
 *   - required timezone designator: Z or ±HH:MM
 *
 * Rejects timezone-less forms like `2026-04-06T00:00:00` which Date.parse
 * silently interprets in the runtime's local timezone. In a non-UTC
 * runtime, an ambiguous input would canonicalize to an off-boundary
 * window — e.g., HST would turn `2026-04-06T00:00:00` into
 * `2026-04-06T10:00:00.000Z`, landing in a different UNIQUE constraint
 * slot than `2026-04-06T00:00:00Z`.
 */
const STRICT_ISO_RE =
  /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Parse a strict ISO 8601 timestamp and return its epoch ms, or null if
 * the input is not in the strict form or represents an impossible date.
 *
 * Two-step validation:
 *   1. Regex shape: enforces explicit timezone and standard structure.
 *   2. Calendar validity: the YYYY-MM-DD portion is round-tripped through
 *      Date at UTC midnight, which catches impossible days (2026-02-31,
 *      2026-13-01, non-leap Feb 29) that Date.parse would silently
 *      normalize into the next month.
 *
 * Impossible time components (25:00:00 etc.) are rejected by Date.parse
 * returning NaN on the full string.
 */
function parseStrictIsoTimestamp(s: string): number | null {
  const match = STRICT_ISO_RE.exec(s);
  if (!match) return null;
  const [, yyyy, mm, dd] = match;
  const dateOnlyMs = Date.parse(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
  if (Number.isNaN(dateOnlyMs)) return null;
  if (new Date(dateOnlyMs).toISOString().slice(0, 10) !== `${yyyy}-${mm}-${dd}`) {
    return null;
  }
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  return ms;
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
  count?: number;
  sum?: { visits?: number; edgeResponseBytes?: number };
  dimensions?: Record<string, string | number>;
}

interface CfGraphQLResponse {
  data?: {
    viewer?: {
      zones?: Array<{
        totals?: CfGroupRow[];
        cacheStatuses?: CfGroupRow[];
        paths?: CfGroupRow[];
        referrers?: CfGroupRow[];
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
  const variables = {
    zoneTag: input.zoneTag,
    start: input.windowStart,
    end: input.windowEnd,
    pathLimit: CF_ANALYTICS_BUDGET.topPathsLimit,
    refererLimit: CF_ANALYTICS_BUDGET.topReferrersLimit,
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
  const { path, referer, country, status, cacheStatus } = CF_GRAPHQL_DIMENSIONS;
  // NOTE: see the file header for the documented facts about which fields
  // exist on httpRequestsAdaptiveGroups. Do not add `sum.requests`,
  // `sum.pageViews`, or `uniq.uniques` — those are not part of the schema.
  return `query ZoneAnalytics(
  $zoneTag: String!
  $start: String!
  $end: String!
  $pathLimit: Int!
  $refererLimit: Int!
  $countryLimit: Int!
  $statusLimit: Int!
) {
  viewer {
    zones(filter: { zoneTag: $zoneTag }) {
      totals: httpRequestsAdaptiveGroups(
        limit: 1
        filter: { datetime_geq: $start, datetime_lt: $end }
      ) {
        count
        sum { visits edgeResponseBytes }
      }
      cacheStatuses: httpRequestsAdaptiveGroups(
        limit: 10
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { ${cacheStatus} }
      }
      paths: httpRequestsAdaptiveGroups(
        limit: $pathLimit
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { ${path} }
        sum { visits }
      }
      referrers: httpRequestsAdaptiveGroups(
        limit: $refererLimit
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { ${referer} }
      }
      countries: httpRequestsAdaptiveGroups(
        limit: $countryLimit
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [count_DESC]
      ) {
        count
        dimensions { ${country} }
      }
      statuses: httpRequestsAdaptiveGroups(
        limit: $statusLimit
        filter: { datetime_geq: $start, datetime_lt: $end }
        orderBy: [count_DESC]
      ) {
        count
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

  const cacheStatusesRaw = zone?.cacheStatuses ?? [];
  const { path, referer, country, status, cacheStatus } = CF_GRAPHQL_DIMENSIONS;

  const cacheStatuses: CfAnalyticsTopRow[] = cacheStatusesRaw.map((row) => ({
    key: String(row.dimensions?.[cacheStatus] ?? ''),
    requests: numberOrZero(row.count),
  }));
  const cachedRequests = cacheStatuses
    .filter((row) => CACHED_STATUS_KEYS.has(row.key.toLowerCase()))
    .reduce((acc, row) => acc + row.requests, 0);

  const totals: CfAnalyticsTotals = {
    requests: numberOrZero(totalsRow?.count),
    visits: numberOrZero(totalsRow?.sum?.visits),
    bytes: numberOrZero(totalsRow?.sum?.edgeResponseBytes),
    cachedRequests,
  };

  return {
    windowStart: input.windowStart,
    windowEnd: input.windowEnd,
    zoneTag: input.zoneTag,
    totals,
    topPaths: (zone?.paths ?? []).map((row) => ({
      key: String(row.dimensions?.[path] ?? ''),
      requests: numberOrZero(row.count),
      visits: numberOrZero(row.sum?.visits),
    })),
    topReferrers: (zone?.referrers ?? []).map((row) => ({
      key: String(row.dimensions?.[referer] ?? ''),
      requests: numberOrZero(row.count),
    })),
    topCountries: (zone?.countries ?? []).map((row) => ({
      key: String(row.dimensions?.[country] ?? ''),
      requests: numberOrZero(row.count),
    })),
    statusCodes: (zone?.statuses ?? []).map((row) => ({
      key: String(row.dimensions?.[status] ?? ''),
      requests: numberOrZero(row.count),
    })),
    cacheStatuses,
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
